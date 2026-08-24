# Africa → Ethiopia motion graphic

Flat 2D infographic animation of the African continent that isolates Ethiopia,
lifts it out of the map, pushes the camera in and fills it with the Ethiopian
flag. Renders in-browser, then captures frame-by-frame to an MP4 ready to drop
straight into CapCut.

**Output:** `output/ethiopia_highlight.mp4` — 1920×1080, 30 fps, 10.00 s, H.264
High / yuv420p / BT.709.

## Quick start

```bash
npm install
npm run build:map   # project Natural Earth boundaries -> src/africa.js
npm run preview     # 13 PNG stills, one per beat, into preview/
npm run render      # all 300 frames -> output/ethiopia_highlight.mp4
```

`npm run all` does the map build and the full render in one go.

Open `src/index.html` directly in a browser to watch it; add `?dev=1` for a
timeline scrubber.

## Shot list

| Time | Beat |
|------|------|
| 0:00–0:02 | Africa fades in — `#E8E6E0` fill, `#B9B6AD` 1px borders, centred, static |
| 0:02–0:04 | Ethiopia's border highlights (stroke → `#6B665C`, 1→1.8px, soft halo) |
| 0:04–0:06 | Ethiopia separates: scales to 1.22×, drop shadow in at 25%; rest of continent dims to 40% |
| 0:06–0:07 | Camera eases toward Ethiopia — 2.83× zoom + recentre |
| 0:07–0:09 | Flag wipes in: green `#078930`, yellow `#FCDD09`, red `#DA121A` |
| 0:09–0:10 | Hold on the final frame for a clean trim point |

All motion uses GSAP `power2.inOut` (ease-in-out cubic) — nothing linear,
nothing bouncy.

## How it works

**Map data.** `scripts/build-map.js` reads Natural Earth 1:50m boundaries from
the public-domain [`world-atlas`](https://www.npmjs.com/package/world-atlas)
TopoJSON, keeps the 54 African entities, and projects them with a d3-geo
equal-area conic (`parallels [-18, 32]`, `rotate [-20, 0]`) fitted to
1920×1080. Output is written as SVG path data to `src/africa.js`, so
`index.html` runs over `file://` with no server and no `fetch`.

Natural Earth attaches far-flung dependencies to their parent country — South
Africa carries the sub-Antarctic Prince Edward Islands ~1800 km offshore. Left
in, they inflate the fitted bounding box and shrink the continent by ~12%, so
polygon rings centred outside the African window are dropped. Mainland and
near-shore boundaries are untouched.

**Border integrity.** Every country is decoded from the *same* TopoJSON
topology, so a shared border is one shared arc referenced by both neighbours —
identical coordinates by construction, not by tolerance. Ethiopia is a single
`Polygon` built from exactly 7 arcs, and all 7 are shared:

| Neighbour | Shared arc |
|---|---|
| Eritrea | 1385 |
| Djibouti | 1386 |
| Somalia | 441 |
| Somaliland | 444 |
| Kenya | 975 |
| South Sudan | 392 |
| Sudan | 400 |

Ethiopia is landlocked, so it has no unshared edge at all — the seam is exact
and cannot gap or overlap when Ethiopia is lifted away. A static
Ethiopia-shaped "socket" stays behind in the continent layer so the silhouette
never shows a hole.

**Determinism.** The animation is one *paused* GSAP timeline driving a plain
state object; nothing reads the wall clock. `window.__anim.seek(t)` renders an
exact instant, so `scripts/render.js` steps Playwright through all 300 frames
rather than screen-recording in real time. No dropped or duplicated frames from
timing jitter.

**Crisp strokes under zoom.** Country borders use `vector-effect:
non-scaling-stroke`, so they stay exactly 1px through the 2.83× camera push.
The drop shadow's `stdDeviation` and `dy` are divided by the live camera zoom
so its *apparent* size stays constant as the camera moves in.

**Colour accuracy.** swscale converts RGB→YUV with the BT.601 matrix unless
told otherwise, while the BT.709 stream tags make players decode as BT.709.
Left mismatched that shifted the flag green to `0,119,45` instead of
`7,137,48`. The encode converts explicitly with
`scale=out_color_matrix=bt709:out_range=tv` to match the tags; the round trip
now lands within 1–3/255 on all three flag colours (62.5 dB PSNR against the
source PNGs).

## Layout

```
scripts/build-map.js   Natural Earth -> projected SVG paths
scripts/render.js      Playwright frame capture + ffmpeg encode
src/index.html         SVG scene graph, filters, clip/mask defs
src/styles.css         flat infographic styling, 1920x1080 stage
src/animation.js       GSAP timeline + seek API
src/africa.js          generated path data (do not edit)
preview/               review stills
output/                final MP4
```

Rendering needs no system ffmpeg or browser download: `ffmpeg-static` supplies
the binary and Playwright uses the pre-installed Chromium.
