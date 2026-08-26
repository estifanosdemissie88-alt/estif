#!/usr/bin/env python3
"""
Generate the "bare feet / NZ dairy" tracking shot as an mp4 using Google's Veo
via the Gemini API.

Usage:
    export GEMINI_API_KEY=...            # https://aistudio.google.com/apikey
    python3 generate_nz_dairy_shot.py

    # variants
    python3 generate_nz_dairy_shot.py --aspect 9:16 --out vertical.mp4
    python3 generate_nz_dairy_shot.py --model veo-3.0-fast-generate-001
    python3 generate_nz_dairy_shot.py --prompt-file my_prompt.txt --seed 7

Stdlib only — no pip install required.

The prompt text is kept in sync with nz_dairy_tracking_shot.md (Master Prompt).
Veo 3 renders a fixed 8-second clip with native audio; --aspect is limited to
16:9 and 9:16, so the 2.39:1 cinemascope framing in the prompt sheet is a crop
in post, not a generation parameter.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "veo-3.0-generate-001"

PROMPT = """\
Extreme close-up tracking shot at ankle height: a pair of bare feet walking along a \
sun-baked concrete footpath, moving directly toward camera as the camera dollies \
backwards at a matched, unhurried walking pace. Skin detail is sharp and tactile - \
dusty tops of the feet, grit and fine sand pressed into the soles, a faint tan line, \
toes splaying slightly as weight rolls from heel to ball on the hot slab. The concrete \
is bleached near-white, crazed with hairline cracks and expansion joints, patched with \
old chewing gum and a scatter of dry grass clippings; short, hard-edged shadows pool \
directly beneath each foot. A shallow layer of heat shimmer ripples off the path in the \
middle distance, subtly warping the background.

Deep in the background, heavily out of focus, sits a classic New Zealand suburban \
"dairy" - a single-storey corner shop with a flat parapet roof, weathered painted \
brickwork, a security grille and a shopfront window layered with sun-faded advertising \
decals. A retro Tip Top ice cream sign hangs above the door, its red and blue enamel \
chalked and washed pale by years of UV. Signage and product ads read as soft coloured \
shapes only, never legible. Fully rendered as creamy bokeh.

Harsh overhead midday sunlight from a high Southern Hemisphere sun: brutally clean \
specular highlights, deep contrast, crushed compact shadows, a slight bleached haze in \
the highlights. Shot on an 85mm lens at T2.0, full-frame, shallow depth of field with \
the focal plane locked to the feet; gentle handheld-stabilised gimbal float, subtle lens \
breathing, faint anamorphic-style highlight flare off the concrete. Photoreal, high \
dynamic range, fine film grain, natural colour with warm concrete and a hard cyan-blue \
sky bounce. No people visible above the ankles.

Audio: a dense wall of cicadas, the soft grit-scrape of bare soles on hot concrete, one \
distant car passing on a quiet suburban street. No music, no dialogue."""

NEGATIVE_PROMPT = (
    "shoes, sandals, jandals, flip-flops, socks, deformed feet, extra toes, fused toes, "
    "mangled anatomy, legible text, readable signage, sharp background, deep focus, "
    "American storefront, strip mall, gas station, neon signs, modern glass shopfront, "
    "golden hour, sunset, long shadows, overcast, soft diffused light, rain, wet ground, "
    "fog, smoke, snow, smeared motion blur, warped ground plane, sliding feet, "
    "floating feet, cartoon, illustration, 3D render, CGI look, oversaturated, "
    "watermark, timestamp, crowd, faces"
)


def request_json(url, api_key, payload=None, timeout=120):
    """POST when payload is given, otherwise GET. Returns parsed JSON."""
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("x-goog-api-key", api_key)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"HTTP {e.code} from {url.split('?')[0]}\n{body}")
    except urllib.error.URLError as e:
        sys.exit(f"Network error contacting {url.split('?')[0]}: {e.reason}")


def find_video_uri(node):
    """Walk the operation response and return the first video URI found.

    Veo's response nesting has moved between API revisions
    (response.generateVideoResponse.generatedSamples[].video.uri and
    response.generatedVideos[].video.uri have both shipped), so resolve it
    structurally rather than by a hardcoded path.
    """
    if isinstance(node, dict):
        for key in ("uri", "videoUri", "url"):
            value = node.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value
        for value in node.values():
            found = find_video_uri(value)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = find_video_uri(item)
            if found:
                return found
    return None


def download(uri, api_key, out_path):
    # The file endpoint needs the same API key; alt=media returns raw bytes.
    if "alt=media" not in uri:
        uri += ("&" if "?" in uri else "?") + "alt=media"
    req = urllib.request.Request(uri)
    req.add_header("x-goog-api-key", api_key)
    try:
        with urllib.request.urlopen(req, timeout=600) as resp, open(out_path, "wb") as fh:
            while chunk := resp.read(1 << 20):
                fh.write(chunk)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} downloading video:\n{e.read().decode(errors='replace')}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=os.environ.get("VEO_MODEL", DEFAULT_MODEL),
                    help=f"Veo model id (default: {DEFAULT_MODEL})")
    ap.add_argument("--aspect", default="16:9", choices=["16:9", "9:16"],
                    help="Veo supports 16:9 and 9:16; crop to 2.39:1 in post")
    ap.add_argument("--resolution", default="1080p", choices=["720p", "1080p"])
    ap.add_argument("--out", default="nz_dairy_tracking_shot.mp4")
    ap.add_argument("--prompt-file", help="Override the built-in prompt")
    ap.add_argument("--seed", type=int, help="Reproducibility seed, if supported")
    ap.add_argument("--poll", type=int, default=10, help="Seconds between status polls")
    ap.add_argument("--timeout", type=int, default=900, help="Give up after N seconds")
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        sys.exit("Set GEMINI_API_KEY (get one at https://aistudio.google.com/apikey)")

    prompt = PROMPT
    if args.prompt_file:
        with open(args.prompt_file) as fh:
            prompt = fh.read()

    parameters = {
        "aspectRatio": args.aspect,
        "resolution": args.resolution,
        "negativePrompt": NEGATIVE_PROMPT,
        # The shot is feet-only, but a person is still implied in frame.
        "personGeneration": "allow_adult",
    }
    if args.seed is not None:
        parameters["seed"] = args.seed

    print(f"Submitting to {args.model} ({args.aspect}, {args.resolution})...")
    op = request_json(
        f"{API_ROOT}/models/{args.model}:predictLongRunning",
        api_key,
        {"instances": [{"prompt": prompt}], "parameters": parameters},
    )

    name = op.get("name")
    if not name:
        sys.exit(f"No operation name in response:\n{json.dumps(op, indent=2)}")
    print(f"Operation: {name}")

    start = time.time()
    while not op.get("done"):
        if time.time() - start > args.timeout:
            sys.exit(f"Timed out after {args.timeout}s. Resume with:\n"
                     f"  curl -H 'x-goog-api-key: $GEMINI_API_KEY' {API_ROOT}/{name}")
        time.sleep(args.poll)
        op = request_json(f"{API_ROOT}/{name}", api_key)
        print(f"  ...rendering ({int(time.time() - start)}s elapsed)")

    if "error" in op:
        sys.exit(f"Generation failed:\n{json.dumps(op['error'], indent=2)}")

    uri = find_video_uri(op.get("response", op))
    if not uri:
        sys.exit("Operation finished but no video URI was found. Full response:\n"
                 + json.dumps(op, indent=2))

    print(f"Downloading -> {args.out}")
    download(uri, api_key, args.out)
    size_mb = os.path.getsize(args.out) / (1 << 20)
    print(f"Done: {args.out} ({size_mb:.1f} MB, 8s with audio)")
    print("Next: crop to 2.39:1 for the cinematic cut, e.g.\n"
          "  ffmpeg -i {0} -vf 'crop=iw:iw/2.39' -c:a copy scope_{0}".format(args.out))


if __name__ == "__main__":
    main()
