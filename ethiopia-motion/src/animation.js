/* Africa -> Ethiopia motion graphic.
 *
 * The whole animation is a single PAUSED GSAP timeline driving one plain state
 * object. Nothing reads the wall clock, so seeking to frame N always produces
 * byte-identical output - that is what makes the offline frame render
 * deterministic. `window.__anim.seek(t)` is the renderer's entry point.
 */
(function () {
  'use strict';

  var DATA = window.AFRICA_DATA;
  var FPS = 30;
  var DURATION = 10; // seconds

  // ---- shot list (seconds) -------------------------------------------------
  var T = {
    fadeIn: [0, 2],   // 1. continent fades in, neutral, static
    cue: [2, 4],      // 2. Ethiopia's border highlights
    lift: [4, 6],     // 3. Ethiopia separates, rest dims
    camera: [6, 7],   // 4. camera eases toward Ethiopia
    flag: [7, 9],     // 5. flag colours wipe in
    hold: [9, 10],    // 6. hold final frame
  };

  // ---- design tokens -------------------------------------------------------
  var NEUTRAL_FILL = '#E8E6E0';
  var BORDER = '#B9B6AD';
  var BORDER_CUE = '#6B665C'; // focus-cue outline
  var BORDER_DEEP = '#33302A'; // outline once the flag is underneath
  var GLOW = '#8C8778';
  var DIMMED = 0.4; // rest-of-continent opacity after separation
  var ETH_SCALE = 1.22; // within the 1.15-1.3 brief
  var SHADOW_OPACITY = 0.25;
  var SHADOW_BLUR = 10; // feDropShadow stdDeviation ~= CSS blur 20px / 2
  var SHADOW_DY = 12;
  var FEATHER = 0.16; // wipe edge softness, as a fraction of Ethiopia's width
  var FEATHER_PX = 0;   // resolved in buildEthiopia()
  var FEATHER_NORM = 0;
  var VIEW_W = DATA.width;
  var VIEW_H = DATA.height;

  var bbox = DATA.ethiopia.bbox;
  // Frame on the bounding-box centre rather than the geographic centroid: it
  // keeps Ethiopia optically centred and makes the scale-up perfectly
  // symmetrical, so the shape never drifts while it grows.
  var PIVOT = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };

  // Zoom so the enlarged Ethiopia occupies ~52% of frame height, but never
  // more than 45% of frame width.
  var CAM_Z = Math.min(
    (VIEW_H * 0.52) / (bbox.h * ETH_SCALE),
    (VIEW_W * 0.45) / (bbox.w * ETH_SCALE)
  );

  // ---- colour helpers ------------------------------------------------------
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixHex(a, b, t) {
    var x = hexToRgb(a);
    var y = hexToRgb(b);
    var c = [0, 1, 2].map(function (i) {
      return Math.round(x[i] + (y[i] - x[i]) * t);
    });
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // ---- build the DOM -------------------------------------------------------
  var $ = function (id) {
    return document.getElementById(id);
  };

  function buildContinent() {
    var g = $('continent');
    var frag = document.createDocumentFragment();
    var ns = 'http://www.w3.org/2000/svg';

    DATA.countries.forEach(function (c) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('class', 'country');
      p.setAttribute('d', c.d);
      p.setAttribute('data-name', c.name);
      frag.appendChild(p);
    });

    // Ethiopia-shaped socket, drawn in the identical neutral style. It stays
    // behind so the continent silhouette never shows a hole once the real
    // Ethiopia lifts off. Because it comes from the same TopoJSON arcs as its
    // neighbours, it seats into them with no gap and no overlap.
    var socket = document.createElementNS(ns, 'path');
    socket.setAttribute('class', 'country');
    socket.setAttribute('id', 'eth-socket');
    socket.setAttribute('d', DATA.ethiopia.d);
    frag.appendChild(socket);

    g.appendChild(frag);
  }

  function buildEthiopia() {
    var d = DATA.ethiopia.d;
    $('eth-clip-path').setAttribute('d', d);

    var glow = $('eth-glow');
    glow.setAttribute('d', d);
    glow.setAttribute('stroke', GLOW);
    glow.setAttribute('stroke-width', '2');
    glow.setAttribute('stroke-linejoin', 'round');

    var fill = $('eth-fill');
    fill.setAttribute('d', d);
    fill.setAttribute('fill', NEUTRAL_FILL);

    var stroke = $('eth-stroke');
    stroke.setAttribute('d', d);
    stroke.setAttribute('stroke-linejoin', 'round');
    stroke.setAttribute('stroke-linecap', 'round');
    stroke.setAttribute('vector-effect', 'non-scaling-stroke');

    // Three equal horizontal bands across Ethiopia's bounding box, clipped to
    // the country outline. Bleed a few px past the box so the clip edge - not
    // the rect edge - defines the shape.
    var B = 6;
    var third = bbox.h / 3;
    var bands = [
      ['band-green', bbox.y - B, third + B],
      ['band-yellow', bbox.y + third, third],
      ['band-red', bbox.y + 2 * third, third + B],
    ];
    bands.forEach(function (b) {
      var r = $(b[0]);
      r.setAttribute('x', bbox.x - B);
      r.setAttribute('y', b[1]);
      r.setAttribute('width', bbox.w + 2 * B);
      r.setAttribute('height', b[2]);
    });

    // Wipe geometry, in the same local space as the bands.
    var pad = 40;
    var r = $('wipe-rect');
    r.setAttribute('x', bbox.x - pad);
    r.setAttribute('y', bbox.y - pad);
    r.setAttribute('width', bbox.w + 2 * pad);
    r.setAttribute('height', bbox.h + 2 * pad);

    // The gradient spans one feather-width PAST each side of the box, so at
    // wipe=0 the whole soft edge is parked outside the shape (nothing shows)
    // and at wipe=1 the solid stop has cleared the far edge (all shows).
    FEATHER_PX = FEATHER * bbox.w;
    FEATHER_NORM = FEATHER_PX / (bbox.w + 2 * FEATHER_PX);
    var grad = $('wipe-grad');
    grad.setAttribute('x1', bbox.x - FEATHER_PX);
    grad.setAttribute('y1', 0);
    grad.setAttribute('x2', bbox.x + bbox.w + FEATHER_PX);
    grad.setAttribute('y2', 0);
  }

  // ---- animation state -----------------------------------------------------
  var S = {
    mapOpacity: 0,
    continentOpacity: 1,
    cue: 0, // 0 -> 1 : border highlight in
    glow: 0,
    ethScale: 1,
    shadow: 0,
    camZ: 1,
    camX: VIEW_W / 2, // point (in map space) parked at frame centre
    camY: VIEW_H / 2,
    wipe: 0, // 0 -> 1 : flag reveal
    deep: 0, // 0 -> 1 : outline darkens over the flag
  };

  function render() {
    // Camera: place (camX, camY) at the centre of the frame at zoom camZ.
    var z = S.camZ;
    var tx = VIEW_W / 2 - z * S.camX;
    var ty = VIEW_H / 2 - z * S.camY;
    $('camera').setAttribute(
      'transform',
      'translate(' + tx.toFixed(4) + ',' + ty.toFixed(4) + ') scale(' + z.toFixed(6) + ')'
    );

    $('map').setAttribute('opacity', S.mapOpacity.toFixed(4));
    $('continent').setAttribute('opacity', S.continentOpacity.toFixed(4));

    // Ethiopia scales about its own bbox centre.
    var s = S.ethScale;
    $('eth-scale').setAttribute(
      'transform',
      'translate(' + PIVOT.x + ',' + PIVOT.y + ') scale(' + s.toFixed(6) + ') ' +
        'translate(' + -PIVOT.x + ',' + -PIVOT.y + ')'
    );

    // Keep the drop shadow's *apparent* size constant while the camera pushes
    // in: the filter runs in pre-camera user space, so divide out the zoom.
    var sh = $('lift-shadow');
    sh.setAttribute('flood-opacity', (S.shadow * SHADOW_OPACITY).toFixed(4));
    sh.setAttribute('stdDeviation', (SHADOW_BLUR / z).toFixed(4));
    sh.setAttribute('dy', (SHADOW_DY / z).toFixed(4));

    var strokeColor = mixHex(BORDER, BORDER_CUE, S.cue);
    if (S.deep > 0) strokeColor = mixHex(BORDER_CUE, BORDER_DEEP, S.deep);
    var st = $('eth-stroke');
    st.setAttribute('stroke', strokeColor);
    st.setAttribute('stroke-width', (1 + 0.8 * S.cue).toFixed(3)); // 1px -> 1.8px

    $('eth-glow').setAttribute('opacity', S.glow.toFixed(4));

    // Feathered wipe: both gradient stops travel together, so the reveal has a
    // soft leading edge rather than a hard cut.
    var a = clamp01(S.wipe * (1 - FEATHER_NORM));
    var b = clamp01(a + FEATHER_NORM);
    $('wipe-a').setAttribute('offset', a.toFixed(5));
    $('wipe-b').setAttribute('offset', b.toFixed(5));
  }

  // ---- timeline ------------------------------------------------------------
  buildContinent();
  buildEthiopia();

  var tl = gsap.timeline({
    paused: true,
    // power2 is GSAP's cubic curve; .inOut gives ease-in-out cubic with no
    // overshoot anywhere in the piece.
    defaults: { ease: 'power2.inOut', lazy: false },
  });

  // 1. (0:00-0:02) full Africa fades in, neutral, centred, static.
  tl.to(S, { mapOpacity: 1, duration: T.fadeIn[1] - T.fadeIn[0] }, T.fadeIn[0]);

  // 2. (0:02-0:04) Ethiopia's border highlights as a focus cue.
  tl.to(S, { cue: 1, duration: T.cue[1] - T.cue[0] }, T.cue[0]);
  tl.to(S, { glow: 0.4, duration: (T.cue[1] - T.cue[0]) * 0.75 }, T.cue[0]);

  // 3. (0:04-0:06) Ethiopia separates; the rest of the continent dims.
  var liftDur = T.lift[1] - T.lift[0];
  tl.to(S, { ethScale: ETH_SCALE, duration: liftDur }, T.lift[0]);
  tl.to(S, { shadow: 1, duration: liftDur }, T.lift[0]);
  tl.to(S, { continentOpacity: DIMMED, duration: liftDur }, T.lift[0]);

  // 4. (0:06-0:07) camera eases toward Ethiopia. The cue glow retires here -
  // the framing itself now carries the focus.
  var camDur = T.camera[1] - T.camera[0];
  tl.to(S, { camZ: CAM_Z, camX: PIVOT.x, camY: PIVOT.y, duration: camDur }, T.camera[0]);
  tl.to(S, { glow: 0, duration: camDur * 0.8 }, T.camera[0]);

  // 5. (0:07-0:09) flag colours wipe in behind a softened edge.
  var flagDur = T.flag[1] - T.flag[0];
  tl.to(S, { wipe: 1, duration: flagDur }, T.flag[0]);
  tl.to(S, { deep: 1, duration: flagDur * 0.7 }, T.flag[0]);

  // 6. (0:09-0:10) hold the final frame for a clean trim point in CapCut.
  tl.to(S, { wipe: 1, duration: T.hold[1] - T.hold[0] }, T.hold[0]);

  render();

  // ---- renderer API --------------------------------------------------------
  window.__anim = {
    fps: FPS,
    duration: DURATION,
    frames: Math.round(DURATION * FPS),
    width: VIEW_W,
    height: VIEW_H,
    cameraZoom: CAM_Z,
    seek: function (t) {
      tl.seek(t, true); // suppressEvents: values still render, callbacks don't
      render();
    },
    ready: true,
  };

  // ---- optional dev scrubber (?dev=1) -------------------------------------
  // Never present during an offline render - the renderer loads the page
  // without the query string.
  if (/[?&]dev=1/.test(location.search)) {
    var bar = document.createElement('input');
    bar.type = 'range';
    bar.min = 0;
    bar.max = DURATION;
    bar.step = 1 / FPS;
    bar.value = 0;
    bar.style.cssText =
      'position:fixed;left:24px;bottom:24px;width:600px;z-index:9';
    var label = document.createElement('div');
    label.style.cssText =
      'position:fixed;left:640px;bottom:20px;font:14px monospace;z-index:9';
    function sync() {
      window.__anim.seek(parseFloat(bar.value));
      label.textContent =
        parseFloat(bar.value).toFixed(2) + 's / ' + DURATION.toFixed(2) + 's';
    }
    bar.addEventListener('input', sync);
    document.body.appendChild(bar);
    document.body.appendChild(label);
    sync();
  }
})();
