/* ==========================================================
   terrain-mesh.js — REAL 3D wireframe terrain built from the reference image.

   The reference wireframe-landscape art is turned into an actual heightfield
   mesh: we read the image's brightness as elevation (bright grid = high
   ground), then build a clean quad wireframe (horizontal + vertical lines, no
   diagonals) from it. The result is genuine geometry — it rotates, tilts, and
   recolours freely (unlike the flat .jpg it replaces).

   One heightmap (the blue reference) drives the geometry for BOTH themes; the
   theme only changes colour + blending (blue glow on dark, ink on white), so
   toggling theme is instant (no rebuild). Material is tagged themeRole:'terrain'
   so the existing THEME controller recolours it live.
   ========================================================== */
(function () {
  var HEIGHTMAP = 'assets/terrain-dark.jpg';   // canonical shape source (2:1)

  function smoothstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // Box-blur a Float32 grid in place-ish (returns a new array), `pass` times.
  function blur(src, cols, rows, pass) {
    var a = src, tmp = new Float32Array(cols * rows);
    for (var p = 0; p < pass; p++) {
      // horizontal
      for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
        var i0 = Math.max(0, i - 1), i1 = Math.min(cols - 1, i + 1);
        tmp[j * cols + i] = (a[j * cols + i0] + a[j * cols + i] + a[j * cols + i1]) / 3;
      }
      // vertical
      var b = new Float32Array(cols * rows);
      for (var jj = 0; jj < rows; jj++) for (var ii = 0; ii < cols; ii++) {
        var j0 = Math.max(0, jj - 1), j1 = Math.min(rows - 1, jj + 1);
        b[jj * cols + ii] = (tmp[j0 * cols + ii] + tmp[jj * cols + ii] + tmp[j1 * cols + ii]) / 3;
      }
      a = b;
    }
    return a;
  }

  /* Build the terrain group. Returns { group, ready } where `group` is added to
     the scene immediately and populated once the image decodes. opts:
       amp        peak height (world units)         default 300
       width,depth  world extent                    default 2000 x 1150
       seed       small per-page shape offset       default 0
       onReady    callback(group) after mesh built  */
  function build(opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var low = (window.PERF && window.PERF.lowEnd);
    var COLS = low ? 150 : 230;         // grid columns (image width → x)
    var ROWS = low ? 84  : 128;         // grid rows (image height → depth)
    var AMP = opts.amp != null ? opts.amp : 300;
    var W = opts.width || 2000, D = opts.depth || 1150;
    var seedShift = (opts.seed || 0) * 0.11;

    var img = new Image();
    img.onload = function () {
      // ---- sample luminance onto a COLS×ROWS grid ----
      var cv = document.createElement('canvas'); cv.width = COLS; cv.height = ROWS;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      // horizontal offset (seed) so pages differ slightly; wrap by shifting draw
      var ox = Math.round(seedShift * COLS);
      ctx.drawImage(img, 0, 0, COLS, ROWS);
      var data = ctx.getImageData(0, 0, COLS, ROWS).data;
      var lum = new Float32Array(COLS * ROWS);
      for (var k = 0; k < COLS * ROWS; k++) {
        lum[k] = (data[k * 4] * 0.33 + data[k * 4 + 1] * 0.5 + data[k * 4 + 2] * 0.17) / 255;
      }
      var big = blur(lum, COLS, ROWS, 4);          // big smooth mountain forms

      // ---- height field: big forms + a little fine detail, with a depth
      //      envelope that flattens the near foreground (plain) and the far
      //      sky, so it reads like the reference composition ----
      function H(i, j) {
        i = Math.max(0, Math.min(COLS - 1, i)); j = Math.max(0, Math.min(ROWS - 1, j));
        var idx = j * COLS + i;
        var h = big[idx] + 0.45 * (lum[idx] - big[idx]);
        h = Math.pow(Math.max(0, h), 1.15);
        var v = j / (ROWS - 1);                    // 0 = far/top, 1 = near/bottom
        var env = smoothstep(0.03, 0.20, v)        // fade the far sky band up
                * (1 - 0.85 * smoothstep(0.72, 1.0, v));  // flatten the near plain
        return h * env;
      }

      // ---- clean quad wireframe (to +x and +z neighbours; no diagonals) ----
      var vx = function (i) { return (i / (COLS - 1) - 0.5) * W; };
      var vz = function (j) { return (j / (ROWS - 1) - 0.5) * D; };
      var pos = [];
      var push = function (i, j) { pos.push(vx(i), H(i, j) * AMP, vz(j)); };
      for (var j2 = 0; j2 < ROWS; j2++) for (var i2 = 0; i2 < COLS; i2++) {
        if (i2 < COLS - 1) { push(i2, j2); push(i2 + 1, j2); }
        if (j2 < ROWS - 1) { push(i2, j2); push(i2, j2 + 1); }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

      var T = window.THEME, t = T ? T.tok() : null;
      var mat = new THREE.LineBasicMaterial({
        color: t ? t.terrain : 0x3f7bff,
        opacity: (t ? t.terrainOp : 0.62) * (opts.opacityScale || 1),
        transparent: true, depthWrite: false,
        blending: (!T || T.additive()) ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      mat.userData.themeRole = 'terrain';
      mat.userData.opacityScale = opts.opacityScale || 1;

      var mesh = new THREE.LineSegments(geo, mat);
      mesh.renderOrder = -20;
      group.add(mesh);
      if (opts.onReady) opts.onReady(group, mesh);
    };
    img.onerror = function () { if (opts.onReady) opts.onReady(group, null); };
    img.src = HEIGHTMAP;

    return group;
  }

  window.TerrainMesh = { build: build, source: HEIGHTMAP };
})();
