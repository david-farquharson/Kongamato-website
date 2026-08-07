/* ==========================================================
   perf.js — one-time GPU capability probe + adaptive quality knobs.
   Loaded right after three.min.js and shared by index.html and
   contact.html.

   Why: the hero is an additive-blended wireframe terrain. On Intel
   integrated GPUs (the typical office Windows machine) line primitives
   + additive overdraw are the bottleneck, and the cost scales with the
   number of pixels each line touches. So on low-end hardware we:
     · render at devicePixelRatio 1  (biggest fill-rate win on HiDPI)
     · disable MSAA                  (useless for 1px lines, costly on iGPU)
     · cap the frame rate to 30 fps  (halves GPU load; fine for a slow,
                                       ambient scene)
   Discrete-GPU machines are left at full quality (DPR up to 2, MSAA on,
   uncapped). Detection is best-effort; when the GPU can't be identified
   we fail safe to the low tier.
   ========================================================== */
(function () {
  function detect() {
    let renderer = '';
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return { renderer: 'none', lowEnd: true };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();           // release the probe context
    } catch (e) {
      return { renderer: 'error', lowEnd: true };
    }

    const s = renderer.toLowerCase();
    const software = /swiftshader|software|llvmpipe|basic render|microsoft basic/.test(s);
    const intel    = /intel/.test(s);                       // integrated → low tier
    const mobile   = /android|iphone|ipad|mobile/i.test(navigator.userAgent || '');
    const fewCores = (navigator.hardwareConcurrency || 8) <= 4;
    // If the renderer string is hidden (privacy), fail safe to low tier.
    const unknown  = !renderer || renderer === 'none' || renderer === 'error';
    const lowEnd   = software || intel || mobile || fewCores || unknown;
    return { renderer, lowEnd, software, intel, mobile, unknown };
  }

  const info = detect();
  const lowEnd = info.lowEnd;

  window.PERF = {
    info: info,
    lowEnd: lowEnd,
    antialias: !lowEnd,
    dprCap: lowEnd ? 1 : 2,
    fpsCap: lowEnd ? 30 : 0,            // 0 = uncapped
    _last: 0,

    /* Build a WebGLRenderer with the adaptive settings applied. */
    makeRenderer: function () {
      const r = new THREE.WebGLRenderer({
        antialias: this.antialias,
        alpha: true,          // transparent canvas so the CSS .mesh-bg backdrop shows through
        stencil: false,
        powerPreference: 'high-performance'   // prefer the discrete GPU on dual-GPU laptops
      });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
      r.setClearAlpha(0);
      return r;
    },

    /* Frame-rate gate for a requestAnimationFrame loop. Pass the rAF
       timestamp; returns true if this frame should render, false to skip.
       Animation timing is unaffected — callers read a real THREE.Clock. */
    gate: function (now) {
      if (!this.fpsCap) return true;
      const min = 1000 / this.fpsCap;
      if (now - this._last < min) return false;
      this._last = now;
      return true;
    }
  };

  try {
    console.info('[perf] GPU:', info.renderer || '(hidden)',
      '| tier:', lowEnd ? 'LOW — adaptive (DPR 1, no MSAA, 30fps)' : 'HIGH — full quality');
  } catch (e) {}
})();
