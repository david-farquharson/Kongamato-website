/* ==========================================================
   scenes.js — procedural wireframe scene builders
   Every model here is generated from code (original geometry).
   ========================================================== */

/* Classic script — expects global THREE (loaded before this file). */

const ACCENT = 0xf6e500;
const GHOST  = 0xffffff;

/* ---------- shared material factory ---------- */
/* Reads window.THEME (js/theme.js) so lines are built in the current theme's
   colour + blending, and tags each material with a themeRole so THEME can
   re-colour it live on toggle. Falls back to the original additive look if
   THEME is absent. */
function wire(color, opacity){
  const T = window.THEME, t = T ? T.tok() : null;
  const role = color === ACCENT ? 'accent' : 'ghost';
  const m = new THREE.LineBasicMaterial({
    color: t ? (role === 'accent' ? t.accent : t.ghost) : color,
    transparent:true, opacity, depthWrite:false,
    blending: (!T || T.additive()) ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  m.userData.themeRole = role;
  return m;
}

/** Wireframe edges of any geometry. */
function edges(geo, color, opacity){
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 12), wire(color, opacity));
}
/** Full triangulated wireframe (denser, mesh-like look). */
function mesh(geo, color, opacity){
  return new THREE.LineSegments(new THREE.WireframeGeometry(geo), wire(color, opacity));
}

/* ==========================================================
   Environment: perspective grid floor + animated horizon waves
   ========================================================== */
function buildEnvironment(){
  const g = new THREE.Group();

  // floor grid — removed: its perspective lines were covering the aircraft
  // const grid = new THREE.GridHelper(900, 110, 0x2a3348, 0x161d2e);
  // grid.position.y = -46;
  // grid.material.transparent = true;
  // grid.material.opacity = .55;
  // g.add(grid);

  // LAYER 3 — dark shade (scrim). Sits between the aircraft (front) and the
  // terrain (back). depthTest:true so the opaque aircraft occludes it (aircraft
  // stays in front); renderOrder puts it above terrain + ribbons.
  const _st = window.THEME ? window.THEME.tok() : null;
  const scrim = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 2500),
    new THREE.MeshBasicMaterial({ color:_st ? _st.scrim : 0x05070f, transparent:true,
      opacity:_st ? _st.scrimOp : .70, depthWrite:false, depthTest:true })
  );
  scrim.material.userData.themeRole = 'scrim';
  scrim.position.set(0, 0, 100);
  scrim.renderOrder = -10;
  g.add(scrim);

  // NOTE: the faint ceiling grid and the horizon "wave ribbons" used to live
  // here. Both are wide, flat, regularly-divided planes seen almost edge-on,
  // so in perspective their parallel lines collapse into a hard "starburst"
  // converging on the vanishing point — the empty fan of lines that read as an
  // eyesore (especially in light mode). Removed for a cleaner horizon; the
  // decimated terrain already carries the depth. Kept commented for easy revert.
  //
  //   const top = new THREE.GridHelper(900, 60, 0x1b2236, 0x11172a);
  //   top.position.y = 150; top.material.transparent = true; top.material.opacity = .18;
  //   g.add(top);
  //
  //   for (let i = 0; i < 5; i++){
  //     const geo = new THREE.PlaneGeometry(1100, 60, 160, 6);
  //     const m = new THREE.LineSegments(new THREE.WireframeGeometry(geo), wire(GHOST, .07 + i*0.025));
  //     m.rotation.x = -Math.PI/2 + 0.16;
  //     m.position.set(0, 6 + i*7 - 45, -120 - i*55);
  //     m.userData.seed = i*1.7; m.renderOrder = -30; g.add(m); waves.push(m);
  //   }

  g.userData.waves = [];   // no ribbons to animate → animateEnvironment no-ops
  return g;
}

/** Animate the horizon ribbons — call each frame. */
function animateEnvironment(env, t){
  (env.userData.waves || []).forEach((w, i) => {
    const pos = w.geometry.attributes.position;
    const seed = w.userData.seed;
    for (let v = 0; v < pos.count; v++){
      const x = pos.getX(v);
      pos.setZ(v,
        Math.sin(x * 0.012 + t * 0.7 + seed) * 7 +
        Math.sin(x * 0.031 - t * 1.1 + seed * 2) * 3.2);
    }
    pos.needsUpdate = true;
    w.position.x = Math.sin(t * 0.12 + i) * 20;
  });
}

/* ==========================================================
   Scene 1 — SURVEY : tracked rover + sensor pod (accent)
   ========================================================== */
function sceneRover(){
  const g = new THREE.Group();

  // chassis
  const body = mesh(new THREE.BoxGeometry(58, 16, 30, 6, 2, 3), GHOST, .3);
  g.add(body);

  // wheels — three per side, dense radial wireframe
  [-1, 1].forEach(side => {
    [-22, 0, 24].forEach(x => {
      const w = mesh(new THREE.CylinderGeometry(15, 15, 8, 22, 3), GHOST, .26);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, -6, side * 19);
      g.add(w);
    });
  });

  // accent: sensor pod mounted on top
  const pod = new THREE.Group();
  pod.add(edges(new THREE.BoxGeometry(22, 30, 18), ACCENT, .95));
  pod.add(mesh(new THREE.BoxGeometry(14, 18, 2, 5, 6, 1), ACCENT, .55));
  const lens = mesh(new THREE.TorusGeometry(5, 1.6, 10, 26), ACCENT, .9);
  lens.position.set(0, -11, 9);
  pod.add(lens);
  pod.position.set(-4, 22, 2);
  pod.userData.spin = true;
  g.add(pod);
  g.userData.accent = pod;

  g.userData.hotspots = [[-0.30, 0.16], [0.10, -0.10]];
  return g;
}

/* ==========================================================
   Scene 5 — PROTECT : Synergy aircraft gltf over rugged mountain gltf
   ========================================================== */
const GLTF_ASSETS = {
  aircraft:  'assets/synergy_full.opt.glb',
  mountains: 'assets/rugged_mountain_landscape.opt.glb'
};
const gltfLoader = new THREE.GLTFLoader();
// Draco decoder: the optimized .glb files are geometry-compressed.
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('js/draco/');
dracoLoader.setDecoderConfig({ type: 'js' });   // wasm auto-used when available
gltfLoader.setDRACOLoader(dracoLoader);

/* Shared model cache: every terrain/aircraft scene reuses ONE decoded gltf
   (cloned per scene) instead of re-downloading + re-decoding per scene. */
const _gltfCache = new Map();
function loadGLTF(url){
  if (!_gltfCache.has(url)){
    _gltfCache.set(url, new Promise((resolve, reject) => {
      gltfLoader.load(url, gltf => resolve(gltf.scene), undefined, err => { gltfError(url)(err); reject(err); });
    }));
  }
  return _gltfCache.get(url);
}
const MOUNTAIN_OFFSET_X = -70;   // shift mountains left so the mass sits centered

/** Debug: surface asset load failures on-screen + console. */
function gltfError(url){
  return err => {
    console.error('GLTF load failed:', url, err);
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;color:#ff5555;background:#200;padding:6px 10px;font:12px monospace;max-width:90vw';
    d.textContent = 'GLTF load failed: ' + url + ' — ' + (err && err.message || err);
    document.body.appendChild(d);
  };
}

/** Swap every mesh material for the site's additive wireframe look. */
function wireframeify(root, color, opacity){
  const T = window.THEME, t = T ? T.tok() : null;
  root.traverse(o => {
    if (o.isMesh){
      o.material = new THREE.MeshBasicMaterial({
        color: t ? t.terrain : color, wireframe:true, transparent:true, opacity,
        depthWrite:false,
        blending: (!T || T.additive()) ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      o.material.userData.themeRole = 'terrain';
    }
  });
}

/* ==========================================================
   Procedural grid-wireframe terrain — replaces the old .glb mountain mesh.
   A subdivided ground plane displaced by fractal value-noise, drawn as a clean
   QUAD grid (horizontal + vertical lines, no diagonals) — the look of the
   reference wireframe-landscape art. Generated entirely in code: no download
   (faster load, esp. on Windows PCs), no decimation, no sparse triangles.
   Density scales to the GPU tier; colour + blending follow the theme
   (glowing blue on dark, ink on white) via the 'terrain' material role.
   ========================================================== */
function _fract(x){ return x - Math.floor(x); }
function _hash(ix, iz, seed){
  return _fract(Math.sin(ix * 127.1 + iz * 311.7 + seed * 57.31) * 43758.5453);
}
function _smooth(t){ return t * t * (3 - 2 * t); }
function _vnoise(x, z, seed){
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const a = _hash(ix, iz, seed),     b = _hash(ix + 1, iz, seed);
  const c = _hash(ix, iz + 1, seed), d = _hash(ix + 1, iz + 1, seed);
  const u = _smooth(fx), v = _smooth(fz);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function _fbm(x, z, seed){
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 5; o++){ sum += amp * _vnoise(x * freq, z * freq, seed + o * 19.3); freq *= 2; amp *= 0.5; }
  return sum;
}

/* Theme-aware line material for the terrain grid. opacityScale lets a scene run
   a touch brighter/dimmer; THEME re-derives opacity on toggle from it. */
function terrainMaterial(opacityScale){
  const T = window.THEME, t = T ? T.tok() : null;
  const m = new THREE.LineBasicMaterial({
    color:       t ? t.terrain    : 0x3f7bff,
    opacity:    (t ? t.terrainOp  : 0.55) * (opacityScale ?? 1),
    transparent: true, depthWrite: false,
    blending: (!T || T.additive()) ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  m.userData.themeRole    = 'terrain';
  m.userData.opacityScale = opacityScale ?? 1;
  return m;
}

function buildProceduralTerrain(opts = {}){
  const seed = opts.seed ?? 1;
  const low  = (window.PERF && PERF.lowEnd);
  const NX = low ? 116 : 182;             // grid columns
  const NZ = low ?  82 : 130;             // grid rows (depth)
  const W = 2000, D = 1600, AMP = 230;    // world extent (x, z) + peak height

  const cols = NX + 1, rows = NZ + 1, n = cols * rows;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
  for (let j = 0; j < rows; j++){
    for (let i = 0; i < cols; i++){
      const u = i / NX, v = j / NZ;                 // v=0 near (front), v=1 far (horizon)
      let h = _fbm(u * 5.0 + 3.1, v * 4.2 + 1.7, seed);
      h = Math.pow(h, 1.35);                        // sharpen ridges
      // envelope: flat plain in the near-centre, rising to ridges at back + sides
      const side = Math.pow(Math.abs(u - 0.5) * 2, 2.2);   // 0 centre → 1 edges
      const back = _smooth(Math.min(1, v * 1.15));         // 0 near → 1 far
      const env  = Math.min(1.25, back * 0.85 + side * 0.75);
      const k = j * cols + i;
      X[k] = (u - 0.5) * W; Z[k] = (v - 0.5) * D; Y[k] = h * env * AMP;
    }
  }

  // clean quad grid: connect each vertex to its +x and +z neighbour (no diagonals)
  const pos = [];
  const put = (i, j) => { const k = j * cols + i; pos.push(X[k], Y[k], Z[k]); };
  for (let j = 0; j < rows; j++){
    for (let i = 0; i < cols; i++){
      if (i < cols - 1){ put(i, j); put(i + 1, j); }
      if (j < rows - 1){ put(i, j); put(i, j + 1); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

  const lines = new THREE.LineSegments(geo, terrainMaterial(opts.opacityScale));
  lines.renderOrder = -20;                 // behind the scrim + aircraft
  const wrap = new THREE.Group();
  wrap.add(lines);
  wrap.position.set(MOUNTAIN_OFFSET_X, -46, -600);   // rest on the floor, recede to horizon
  return wrap;
}

function sceneCessnaTerrain(opts = {}){
  const hoverBase  = opts.hoverBase ?? 26;
  const aircraft   = opts.aircraft ?? true;        // show the Synergy aircraft?
  const floorRings = opts.floorRings ?? false;     // gold contour rings on the floor?
  const g = new THREE.Group();

  // Lazy: models are only fetched/decoded the first time this scene is shown.
  // app.js calls g.userData.lazyLoad() on first visibility. Shared cache means
  // the terrain + aircraft download + decode ONCE and are cloned per scene.
  let loaded = false;
  g.userData.lazyLoad = function(){
    if (loaded) return; loaded = true;

  // --- procedural grid terrain (generated in code — no download/decode) ---
  g.add(buildProceduralTerrain({ seed: opts.seed, opacityScale: opts.opacityScale }));

  // --- foreground: Synergy aircraft (solid body, from synergy.blend) ---
  if (aircraft){
  loadGLTF(GLTF_ASSETS.aircraft).then(src => {
    const jet = src.clone(true);
    // Blender-exported materials are used as-is (colours baked in the .glb)
    // lighting rig on the unscaled parent so it always points at the plane
    plane.add(new THREE.AmbientLight(0xffffff, .5));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(60, 120, 180);
    plane.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xffffff, .8);
    fill.position.set(-120, -40, -100);
    plane.add(fill, fill.target);
    // normalize: longest side = 105 world units (50% of previous), centred
    const box = new THREE.Box3().setFromObject(jet);
    const size = box.getSize(new THREE.Vector3());
    jet.scale.setScalar(105 / Math.max(size.x, size.y, size.z));
    box.setFromObject(jet);
    jet.position.sub(box.getCenter(new THREE.Vector3()));
    // isometric orientation to match previous staging
    jet.rotation.order = 'YXZ';
    jet.rotation.y = THREE.MathUtils.degToRad(250);
    jet.rotation.x = THREE.MathUtils.degToRad(-10);
    // LAYER 2 (front) — aircraft: draws in front of the dark shade.
    jet.traverse(o => { if (o.isMesh){ o.renderOrder = 10; } });
    plane.add(jet);
  });
  }
  }; // end lazyLoad

  // aircraft container is created synchronously so hover/accent refs exist
  const plane = new THREE.Group();
  if (aircraft){
  plane.position.set(-80, 10, 150);  // z=150: well in front of the mountains
  g.add(plane);
  g.userData.accent = plane;
  g.userData.hover = plane;
  g.userData.hoverBase = hoverBase;
  }

  // --- optional: gold contour rings on the floor plane ---
  if (floorRings){
    const contours = new THREE.Group();
    for (let i = 0; i < 9; i++){
      const pts = [];
      const R = 26 + i * 15, N = 74;
      for (let a = 0; a <= N; a++){
        const th = (a / N) * Math.PI * 2;
        const wob = Math.sin(th * 3 + i) * 9 + Math.sin(th * 7 - i * 2) * 4;
        pts.push(new THREE.Vector3(Math.cos(th) * (R + wob), 0, Math.sin(th) * (R + wob) * .7));
      }
      contours.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        wire(ACCENT, .30 - i * 0.022)));
    }
    contours.position.y = -44;
    g.add(contours);
  }

  g.userData.hotspots = [[-0.10, 0.12], [0.14, -0.02]];
  return g;
}
// Per-page terrain shape via seed; seeds cycle 1→2→3 across the pages, colour
// follows the theme (glow on dark / ink on white).
function sceneProtect(){ return sceneCessnaTerrain({ aircraft:false, seed:2 }); }   // design_studio
function sceneSlider(){  return sceneCessnaTerrain({ hoverBase: 28, seed:1 }); }    // what_we_do

/* ==========================================================
   Scene 2 — INSPECT : tank hall + AR tablet overlay (accent)
   ========================================================== */
function sceneInspect(){  // OPEN SOURCE: terrain only, a touch brighter
  return sceneCessnaTerrain({ aircraft:false, seed:1, opacityScale:1.15 });
}

/* ==========================================================
   Scene 3 — SIMULATE : training cabin frame + seat (accent)
   ========================================================== */
function sceneSimulate(){ // TRAINING: aircraft over terrain
  return sceneCessnaTerrain({ hoverBase: 28, seed:2 });
}

/* ==========================================================
   Scene 4 — SCOUT : survey drone over contour terrain (accent)
   ========================================================== */
function sceneScout(){    // AVIONICS: terrain only
  return sceneCessnaTerrain({ aircraft:false, seed:3 });
}

/* ==========================================================
   Scene 0 — OVERTURE : abstract intro lattice
   ========================================================== */
function sceneOverture(){
  const g = new THREE.Group();

  const core = mesh(new THREE.IcosahedronGeometry(38, 2), ACCENT, .55);
  g.add(core);
  const shell = mesh(new THREE.IcosahedronGeometry(64, 1), GHOST, .16);
  g.add(shell);

  // orbiting rings
  [0, 1, 2].forEach(i => {
    const r = mesh(new THREE.TorusGeometry(84 + i * 16, .8, 4, 90), GHOST, .2);
    r.rotation.set(Math.PI / 2 - i * 0.5, i * 0.7, i * 0.3);
    g.add(r);
  });

  g.userData.accent = core;
  g.userData.spinAll = true;
  g.userData.hotspots = [[0, 0]];
  return g;
}

/* ==========================================================
   Registry — id / title / copy / camera / builder
   Copy text is placeholder: replace with your own.
   ========================================================== */
const SCENES = [
  {
    id:'what_we_do', label:'what_we_do', title:'What We Do',
    body:'Kongamato is building toward end-to-end capability: an aircraft designed, built, and flown under one roof, with the tools and training pipeline that make that repeatable. The stages below describe the full scope we are working toward.<br><b>Design: </b>Conceptual sizing, aerodynamics, structures, systems, and avionics — supported by our own simulation tools. This is where Design Studio already operates: constraint diagrams, drag polars, load envelopes, and CFD, running today.<br><b>Build: </b>Tooling, composite part fabrication, assembly, and systems integration. Bringing airframe manufacture in-house is what closes the loop between a design change and a flying article.<br><b>Education and Research: </b>Research and development, flight and ground testing, and STEM mentorship. We treat training as core work, not outreach.',
    copyPos:{ right:'200px', bottom:'150px',  maxWidth:'630px' },   // <-- this scene's text position
    cuePos:{ left:'600px', bottom:'200px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[0, 30, 250], look:[0, 10, 0], build:sceneSlider
  },
  {
    id:'design_studio', label:'design_studio', title:'Design Studio',
    body:'Runs offline from a single HTML file. No libraries, no build step, no network, open it and it works. Aircraft Design Studio is a browser-based conceptual-design workbench for aircraft and drones, with nine linked analysis tabs covering the sizing calculations aerospace engineers actually use: constraint diagrams, drag polars, V-n envelopes, weight and CG build-up, and stability derivatives. Every tab shares one design state, so changing gross weight propagates through the geometry, performance, and structural envelope at once. The ninth tab is a live Lattice-Boltzmann CFD wind tunnel; upload any STL or OBJ and it voxelizes the mesh onto a D3Q19 lattice, solves transient viscous flow on the GPU, and returns lift and drag by momentum exchange alongside a full ISA atmosphere solution.',
    copyPos:{ right:'200px', bottom:'150px', maxWidth:'500px' },   // <-- this scene's text position
    // cuePos:{ left:'900px', top:'-100px' },                          
    cam:[10, 46, 165], look:[6, 8, 0], build:sceneProtect
  },
    {
    id:'avionics', label:'avionics', title:'Avionics',
    body:'Kongamato is building an open-source, full-stack avionics platform for experimental aviation: a glass cockpit, an AR smart-glasses HUD, and an autopilot commanded by plain voice or text. The target capability set includes auto takeoff and landing, nearest-airport diversion, wind-aware pattern work, and traffic and obstacle awareness; supervised from the panel or the HUD, and overridable by the Pilot in Command at all times.',
    copyPos:{ left:'300px', bottom:'300px' },   // <-- this scene's text position
    // cuePos:{ top:'-100px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[-26, 52, 210], look:[10, 6, 0], build:sceneScout
  },
  {
    id:'open_source', label:'open_source', title:'Open Source',
    body:'Everything Kongamato builds is released under Apache 2.0: the tools, the avionics, the airframe data. Below is the current state of the code, what we have validated it against, and where it breaks. We publish the limits alongside the capabilities because avionics that hold lives should be auditable by anyone who wants to check the work.  This page is a living document. It reflects what exists today, not what we intend to build.',
    copyPos:{ left:'300px', bottom:'300px' , maxWidth:'530px' },   // <-- this scene's text position
    cuePos:{ right:'100px', bottom:'200px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[-14, 34, 205], look:[8, 4, 0], build:sceneInspect
  },
  {
    id:'training', label:'training', title:'Training and STEM',
    body:'Aviation has a pipeline problem: the tools that teach real aircraft design are expensive, licensed, and locked to institutions that can afford them. Ours runs in a browser, offline, for free.<b>For students.</b> Design Studio puts the same sizing calculations used in professional practice; constraint diagrams, drag polars, V-n envelopes, stability derivatives, CFD; in front of any high school or college student with a laptop. No license, no install, no lab requirement. Paired with mentorship, it gives students a path from first sketch to a design they can defend. <b>For professionals.</b> Structured training across the full design-build cycle, from conceptual sizing through composite fabrication and systems integration, for engineers moving into experimental and unmanned aviation. Everything we build is released under Apache 2.0. Avionics that hold lives should be auditable by anyone who wants to check the work; and tools that teach should be available to anyone who wants to learn.',    //body:'Aviation has a pipeline problem: the tools that teach real aircraft design are expensive, licensed, and locked to institutions that can afford them. Ours runs in a browser, offline, for free.<br><br><b>For students.</b> Design Studio puts the same sizing calculations used in professional practice; constraint diagrams, drag polars, V-n envelopes, stability derivatives, CFD; in front of any high school or college student with a laptop. No license, no install, no lab requirement. Paired with mentorship, it gives students a path from first sketch to a design they can defend.<br><br><b>For professionals.</b> Structured training across the full design-build cycle, from conceptual sizing through composite fabrication and systems integration, for engineers moving into experimental and unmanned aviation.<br><br>Everything we build is released under Apache 2.0. Avionics that hold lives should be auditable by anyone who wants to check the work; and tools that teach should be available to anyone who wants to learn.',
    copyPos:{ Right:'200px', bottom:'140px', maxWidth:'630px' },   // <-- this scene's text position
    //cuePos:{ top:'-100px' },                 // <-- this scene's \"scroll to discover\" position
    cam:[36, 40, 235], look:[6, -4, 0], build:sceneSimulate
  }

];
