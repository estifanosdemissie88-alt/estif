# NZ DAIRY — "Bare Feet on Hot Concrete" (Tracking Shot Prompt Sheet)

> Generative-video prompt pack for a single hero shot: a low, close tracking shot of bare feet
> on a sun-baked footpath, with a classic New Zealand dairy melting out of focus behind.
> Copy the **Master Prompt** straight into a text-to-video model; use the variants below to
> match a specific model's prompt grammar.

---

## THE SHOT IN ONE LINE

Ankle-height tracking shot, bare feet slapping hot concrete, heat shimmer rising, a faded
Kiwi corner dairy bokeh'd out behind — harsh Southern Hemisphere midday sun.

---

## MASTER PROMPT (model-agnostic)

```
Extreme close-up tracking shot at ankle height: a pair of bare feet walking along a
sun-baked concrete footpath, moving directly toward camera as the camera dollies
backwards at a matched, unhurried walking pace. Skin detail is sharp and tactile —
dusty tops of the feet, grit and fine sand pressed into the soles, a faint tan line,
toes splaying slightly as weight rolls from heel to ball on the hot slab. The concrete
is bleached near-white, crazed with hairline cracks and expansion joints, patched with
old chewing gum and a scatter of dry grass clippings; short, hard-edged shadows pool
directly beneath each foot. A shallow layer of heat shimmer ripples off the path in
the middle distance, subtly warping the background.

Deep in the background, heavily out of focus, sits a classic New Zealand suburban
"dairy" — a single-storey corner shop with a flat parapet roof, weathered painted
brickwork, a security grille and a shopfront window layered with sun-faded advertising
decals. A retro Tip Top ice cream sign hangs above the door, its red and blue enamel
chalked and washed pale by years of UV. Signage and product ads read as soft coloured
shapes only, never legible. Fully rendered as creamy bokeh.

Harsh overhead midday sunlight from a high Southern Hemisphere sun: brutally clean
specular highlights, deep contrast, crushed compact shadows, a slight bleached haze in
the highlights. Shot on an 85mm lens at T2.0, full-frame, shallow depth of field with
the focal plane locked to the feet; gentle handheld-stabilised gimbal float, subtle
lens breathing, faint anamorphic-style highlight flare off the concrete. Photoreal,
high dynamic range, fine film grain, natural colour with warm concrete and a hard
cyan-blue sky bounce. No people visible above the ankles.
```

---

## RENDERING THE MP4

`generate_nz_dairy_shot.py` submits the Master Prompt to Veo and writes the mp4. Stdlib
only, no dependencies:

```bash
export GEMINI_API_KEY=...        # https://aistudio.google.com/apikey
python3 generate_nz_dairy_shot.py
```

Output is an 8-second 1080p clip with native audio, `nz_dairy_tracking_shot.mp4`.

```bash
python3 generate_nz_dairy_shot.py --aspect 9:16 --out vertical.mp4   # social cut
python3 generate_nz_dairy_shot.py --model veo-3.0-fast-generate-001  # cheaper draft
python3 generate_nz_dairy_shot.py --seed 7                           # reproducible
```

Veo generates 16:9 or 9:16 only, so the 2.39:1 framing is a crop in post:

```bash
ffmpeg -i nz_dairy_tracking_shot.mp4 -vf 'crop=iw:iw/2.39' -c:a copy scope.mp4
```

Expect to burn a few generations. Render two or three cheap drafts with the fast model,
pick the one where the feet plant properly and the dairy stays illegible, then re-run
that seed at full quality. The **Troubleshooting** table at the bottom maps the common
failures back to prompt edits.

---

## STRUCTURED BREAKDOWN

| Element | Direction |
|---|---|
| **Subject** | Bare feet, mid-stride, walking toward camera. Dusty, sun-warmed skin, grit on the soles. No footwear anywhere in frame. |
| **Camera** | Ankle height (~15 cm off the ground), backwards dolly/gimbal, matched walking pace. Feet stay centred and roughly the same size in frame throughout. |
| **Lens** | 85mm full-frame at T2.0 (long lens compresses the dairy and maximises shimmer read). 50mm if you want more footpath context. |
| **Focus** | Locked to the feet the entire shot. Background never resolves. No rack focus. |
| **Foreground** | Bleached concrete slabs, hairline crazing, expansion joints, old gum, dry grass clippings, a scatter of fine grit. |
| **Midground** | Heat shimmer layer — visible as a warping distortion over the path and the base of the shop, not as fog or smoke. |
| **Background** | NZ dairy: flat parapet roof, painted brick or weatherboard, security grille, faded window decals, retro Tip Top ice cream sign. All bokeh. |
| **Light** | Sun high and slightly to the north (Southern Hemisphere). Short shadows falling toward camera-south. Hard, unforgiving, no diffusion. |
| **Colour** | Bleached warm concrete, hot skin tones, pale washed reds and blues in the signage, hard blue sky bounce in the shadows. |
| **Motion** | Steady, unhurried. Two to three full strides in an 8-second beat. |
| **Duration** | 6–8 seconds. |
| **Aspect** | 2.39:1 for cinematic cut; 9:16 vertical variant crops tighter to the feet and keeps the Tip Top sign in the upper third. |

---

## AUTHENTICITY NOTES (get these right or it reads as "generic corner store")

- A **dairy** is a small suburban convenience shop, usually on a residential corner, not a strip-mall unit. Single storey, flat parapet roof hiding the roofline, often a bullnose verandah over the footpath.
- Signage is **layered and sun-killed** — decades of overlapping ads, some peeling, plus hand-lettered A4 signs taped inside the glass. Faded is the whole point; nothing looks new.
- The **Tip Top** sign is the anchor prop: an enamel or moulded ice cream sign above or beside the door, its reds gone salmon-pink from UV.
- **Bare feet in public** is culturally normal in New Zealand — no explanation needed in frame, and no jandals, no shoes carried in hand.
- **Southern Hemisphere sun** at midday sits to the *north*. Shadows point south. If the model renders long shadows, the time of day has drifted — reinforce "sun directly overhead, shortest shadows of the day."
- Concrete in NZ suburbs is typically **poured slabs with expansion joints**, not pavers or asphalt.

---

## NEGATIVE PROMPT

```
shoes, sandals, jandals, flip-flops, socks, feet deformed, extra toes, six toes,
fused toes, mangled anatomy, legible text, readable signage, sharp background,
deep focus, American storefront, strip mall, gas station, neon signs, modern
glass shopfront, golden hour, sunset, long shadows, overcast, soft diffused light,
rain, wet ground, fog, smoke, snow, motion blur smearing, warped ground plane,
sliding feet, floating feet, cartoon, illustration, 3D render, CGI look,
oversaturated, HDR halos, watermark, timestamp, crowd, faces, car in foreground
```

---

## MODEL VARIANTS

### Veo (with native audio)

```
Ankle-height tracking shot moving backwards ahead of a pair of bare feet walking a
bleached concrete footpath in midday sun. Grit on the soles, short hard shadows, heat
shimmer rippling off the slab. Far behind and completely out of focus: a New Zealand
corner dairy, faded window ads, a retro Tip Top ice cream sign. 85mm, T2.0, shallow
focus locked on the feet, subtle gimbal float, photoreal, fine grain.

Audio: a dense wall of cicadas, the soft grit-scrape of bare soles on hot concrete,
one distant car passing on a quiet suburban street, a fly close to the mic. No music,
no dialogue.
```

### Sora

```
A camera hovers fifteen centimetres above a sun-bleached concrete footpath and glides
backwards, holding on a pair of bare feet walking toward it in the heat of the day.
The soles are dusted with grit; shadows sit tight and black directly under the arches.
Heat shimmer distorts the path ahead. Somewhere far behind, dissolved into soft
coloured bokeh, is a small New Zealand corner dairy with a faded Tip Top ice cream
sign above the door. Harsh overhead summer light, 85mm shallow focus, documentary
realism, no people above the ankles.
```

### Runway / Kling / Luma (short, comma-weighted)

```
extreme close-up bare feet walking on hot cracked concrete footpath, low ankle-level
camera tracking backwards, grit on soles, heat shimmer, harsh midday overhead sun,
short hard shadows, blurred New Zealand corner dairy shopfront in far background,
faded window advertising, retro Tip Top ice cream sign, 85mm shallow depth of field,
photorealistic, film grain, 2.39:1
```

**Camera motion setting:** dolly out / backwards, speed low, horizontal and vertical pan off.

### Still frame (Midjourney / Flux — for storyboard or plate)

```
extreme close-up of bare feet mid-stride on a bleached, crazed concrete footpath,
grit pressed into the soles, tight black midday shadows, heat shimmer rising, a faded
New Zealand corner dairy far out of focus behind with a retro Tip Top ice cream sign
and sun-killed window ads, 85mm f/1.8, shallow depth of field, harsh overhead
Southern Hemisphere summer sun, photorealistic, fine grain --ar 21:9 --style raw
```

---

## SOUND DESIGN (if cutting to picture)

- **Bed:** cicada drone — dense, unbroken, slightly overwhelming. This single element does more for "NZ summer" than any visual.
- **Foley:** bare soles on hot grit — a soft scuff and peel, not a slap. Add a faint hesitation on one step, as if the concrete is too hot.
- **Distance:** one car passing two streets over. A screen door on a spring, far off.
- **Silence:** no music under this shot. If it's a cold open, let the cicadas run alone for the full beat before any narration lands.

---

## COVERAGE / CUTAWAYS FROM THE SAME SETUP

1. **Match cut, same lens:** feet stop at the dairy's doorstep, one foot lifting onto cool shaded lino — hard light to shade in a single frame.
2. **Reverse:** same ankle height, camera now behind, feet walking away, dairy resolving into focus for the first time.
3. **Insert:** the Tip Top sign in sharp focus, sun blowing out one corner of the enamel, shot from the footpath looking up.
4. **Wide:** locked-off wide of the whole dairy from across the road, heat shimmer over the tarmac, figure entering frame small.

---

## TROUBLESHOOTING

| Problem | Fix |
|---|---|
| Feet slide or skate along the ground | Lower camera speed; add "weight rolls heel to ball, toes grip on push-off, footfalls plant firmly." |
| Shadows too long / light too warm | Add "sun directly overhead, shortest shadows of the day, harsh white noon light" and negative-prompt golden hour. |
| Background resolves into readable signs | Strengthen shallow-focus language: "background dissolved into unreadable coloured bokeh, signage illegible." |
| Heat shimmer reads as fog or smoke | Replace with "refractive air distortion warping the background, no visible haze or particles." |
| Shop looks American | Lead with structure, not the label: "single-storey corner shop, flat parapet roof, bullnose verandah, painted brick, security grille." |
| Toe anatomy breaks | Reduce how much of the foot is in frame per stride, or hold focus slightly forward so toes fall just off the focal plane. |
