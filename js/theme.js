/* ==========================================================
   theme.js — light / dark theme controller (default: dark)

   Loaded after three.min.js and BEFORE scenes.js, so the scene material
   factories (js/scenes.js) can read the current theme at build time.

   Themes two things at once:
     · the DOM  — via `data-theme` on <html> + CSS variables (css/style.css)
     · the 3D   — clear colour, fog, and every wireframe material. On a light
                  background additive-blended white lines vanish, so light
                  mode switches those materials to NORMAL blending with a dark
                  "ink" colour. Dark mode is byte-for-byte the original look.

   A tiny inline script in each page's <head> sets `data-theme` synchronously
   to avoid a flash; this module then owns all subsequent changes.
   ========================================================== */
(function () {
  var KEY = 'kongamato-theme';

  // Scene colour tokens per theme. `additive:true` reproduces the original
  // glow; light mode uses normal blending so dark lines read on a light sky.
  var TOK = {
    // terrain: glowing blue grid on dark (like the neon reference), dark "ink"
    // grid on the near-white light theme. terrainOp is the base line opacity.
    dark:  { clear:0x05070f, fog:0x05070f, ghost:0xffffff, accent:0xf6e500,
             terrain:0x3f7bff, terrainOp:0.60, scrim:0x05070f, scrimOp:0.22, additive:true },
    light: { clear:0xe9edf4, fog:0xe4e9f1, ghost:0x2a3555, accent:0x8a6a00,
             terrain:0x171b24, terrainOp:0.70, scrim:0xffffff, scrimOp:0.10, additive:false }
  };

  var mode = 'dark';
  try { var s = localStorage.getItem(KEY); if (s === 'light' || s === 'dark') mode = s; } catch (e) {}
  // deep-link / test override: ?theme=light|dark
  var q = (location.search.match(/[?&]theme=(light|dark)/) || [])[1];
  if (q) mode = q;

  var renderer = null, scene = null;
  function tok() { return TOK[mode]; }
  function blend() { return tok().additive ? THREE.AdditiveBlending : THREE.NormalBlending; }

  /* Re-colour the live scene (called on attach and on every toggle). Materials
     opt in by tagging themselves with userData.themeRole in scenes.js. */
  function applyScene() {
    var t = tok();
    if (renderer) renderer.setClearColor(t.clear, 1);
    if (scene && scene.fog) scene.fog.color.setHex(t.fog);
    if (!scene) return;
    scene.traverse(function (o) {
      if (!o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i], role = m.userData && m.userData.themeRole;
        if (!role) continue;
        if (role === 'ghost')        { m.color.setHex(t.ghost);   m.blending = blend(); }
        else if (role === 'accent')  { m.color.setHex(t.accent);  m.blending = blend(); }
        else if (role === 'terrain') { m.color.setHex(t.terrain); m.blending = blend();
                                       m.opacity = t.terrainOp * (m.userData.opacityScale || 1); }
        else if (role === 'scrim')   { m.color.setHex(t.scrim);   m.opacity  = t.scrimOp; }
        m.needsUpdate = true;
      }
    });
  }

  function applyDOM() {
    document.documentElement.setAttribute('data-theme', mode);
    var toggles = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
      toggles[i].setAttribute('title', mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
  }

  window.THEME = {
    get mode() { return mode; },
    tok: tok,
    blend: blend,
    // scenes call this so async-loaded materials pick the right blending
    additive: function () { return tok().additive; },
    // app.js / contact-stage.js hand over their renderer + scene once built
    attach: function (r, sc) { renderer = r; scene = sc; applyScene(); },
    set: function (next) {
      mode = (next === 'light') ? 'light' : 'dark';
      try { localStorage.setItem(KEY, mode); } catch (e) {}
      applyDOM();
      applyScene();
    },
    toggle: function () { this.set(mode === 'light' ? 'dark' : 'light'); }
  };

  function init() {
    applyDOM();
    var toggles = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function () { window.THEME.toggle(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
