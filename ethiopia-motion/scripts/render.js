#!/usr/bin/env node
/**
 * render.js - offline frame-accurate renderer.
 *
 *   node scripts/render.js --preview   dump a handful of PNG stills for review
 *   node scripts/render.js             render every frame, then encode to MP4
 *
 * The page exposes a paused GSAP timeline via window.__anim.seek(t), so this
 * drives the animation one exact frame at a time instead of screen-recording
 * in real time. Output is therefore deterministic and never drops a frame.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { chromium } = require('playwright');
const ffmpegPath = require('ffmpeg-static');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'src', 'index.html');
const FRAME_DIR = path.join(ROOT, 'frames');
const PREVIEW_DIR = path.join(ROOT, 'preview');
const OUT_DIR = path.join(ROOT, 'output');
const OUT_FILE = path.join(OUT_DIR, 'ethiopia_highlight.mp4');

const PREVIEW_ONLY = process.argv.includes('--preview');
const ENCODE_ONLY = process.argv.includes('--encode-only');
// Timestamps that show each beat of the shot list.
const PREVIEW_TIMES = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 6.5, 7.0, 7.6, 8.2, 9.0, 9.9];

function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve({ stdout, stderr })
    );
  });
}

function emptyDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
}

(async () => {
  if (ENCODE_ONLY) {
    const frames = fs.readdirSync(FRAME_DIR).filter((f) => f.endsWith('.png'));
    if (!frames.length) throw new Error('no frames on disk - run without --encode-only');
    await encode({ fps: 30, frames: frames.length });
    return;
  }
  const browser = await chromium.launch({
    args: [
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      '--disable-lcd-text',
      // Deterministic rasterisation across runs.
      '--disable-gpu',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });

  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__anim && window.__anim.ready);

  const meta = await page.evaluate(() => ({
    fps: window.__anim.fps,
    duration: window.__anim.duration,
    frames: window.__anim.frames,
    width: window.__anim.width,
    height: window.__anim.height,
    cameraZoom: window.__anim.cameraZoom,
    countries: document.querySelectorAll('#continent .country').length,
    ethPathLen: document.getElementById('eth-fill').getAttribute('d').length,
  }));

  console.log('scene loaded');
  console.log(`  countries in continent layer : ${meta.countries} (incl. Ethiopia socket)`);
  console.log(`  Ethiopia path data           : ${meta.ethPathLen} chars`);
  console.log(`  camera zoom at end           : ${meta.cameraZoom.toFixed(3)}x`);
  console.log(`  timeline                     : ${meta.duration}s @ ${meta.fps}fps = ${meta.frames} frames`);

  const clip = { x: 0, y: 0, width: meta.width, height: meta.height };

  async function shoot(t, file) {
    await page.evaluate((time) => window.__anim.seek(time), t);
    await page.screenshot({ path: file, clip, type: 'png', animations: 'disabled' });
  }

  if (PREVIEW_ONLY) {
    emptyDir(PREVIEW_DIR);
    for (const t of PREVIEW_TIMES) {
      const file = path.join(PREVIEW_DIR, `t_${t.toFixed(2).replace('.', '_')}s.png`);
      await shoot(t, file);
      console.log('preview  ' + path.relative(ROOT, file));
    }
    await browser.close();
    console.log('\npreview stills written to ' + PREVIEW_DIR);
    return;
  }

  // ---- full frame render ---------------------------------------------------
  emptyDir(FRAME_DIR);
  const started = Date.now();
  for (let i = 0; i < meta.frames; i++) {
    const t = i / meta.fps;
    await shoot(t, path.join(FRAME_DIR, `frame_${String(i).padStart(5, '0')}.png`));
    if (i % 30 === 0 || i === meta.frames - 1) {
      const pct = (((i + 1) / meta.frames) * 100).toFixed(0);
      process.stdout.write(`\r  frame ${i + 1}/${meta.frames}  (${pct}%)   `);
    }
  }
  process.stdout.write('\n');
  await browser.close();
  console.log(`captured ${meta.frames} frames in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  await encode(meta);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function encode(meta) {
  // ---- encode --------------------------------------------------------------
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const args = [
    '-y',
    '-framerate', String(meta.fps),
    '-i', path.join(FRAME_DIR, 'frame_%05d.png'),
    // swscale converts RGB->YUV with the BT.601 matrix unless told otherwise,
    // while the bt709 tags below make every player decode as BT.709. Left
    // mismatched that shifts saturated colour by up to ~19/255 - the flag
    // green measured 0,119,45 instead of 7,137,48. Converting explicitly with
    // the same matrix we tag keeps the round-trip within 1-2 levels.
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',      // required for CapCut / QuickTime compatibility
    '-profile:v', 'high',
    '-level', '4.1',
    '-colorspace', 'bt709',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-movflags', '+faststart',
    '-r', String(meta.fps),
    OUT_FILE,
  ];
  console.log('encoding H.264 ...');
  await run(ffmpegPath, args);

  // ---- verify --------------------------------------------------------------
  const probe = await run(ffmpegPath, ['-hide_banner', '-i', OUT_FILE]).catch((e) => ({
    stderr: e.message,
  }));
  const info = probe.stderr;
  const stream = (info.match(/Stream #0:0.*\n/) || [''])[0].trim();
  const duration = (info.match(/Duration: ([0-9:.]+)/) || [])[1];
  const size = fs.statSync(OUT_FILE).size;

  console.log('\n========================================');
  console.log('OUTPUT : ' + OUT_FILE);
  console.log('size   : ' + (size / 1024 / 1024).toFixed(2) + ' MB');
  console.log('dur    : ' + duration);
  console.log('frames : ' + meta.frames);
  console.log('stream : ' + stream);
  console.log('========================================');
}
