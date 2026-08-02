/* ==========================================================
   scenes.js — procedural wireframe scene builders
   Every model here is generated from code (original geometry).
   ========================================================== */

/* Classic script — expects global THREE (loaded before this file). */

const ACCENT = 0xf6e500;
const GHOST  = 0xffffff;

/* ---------- shared material factory ---------- */
function wire(color, opacity){
  return new THREE.LineBasicMaterial({
    color, transparent:true, opacity,
    depthWrite:false, blending:THREE.AdditiveBlending
  });
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

  // faint upper grid (ceiling) for enclosed feel
  const top = new THREE.GridHelper(900, 60, 0x1b2236, 0x11172a);
  top.position.y = 150;
  top.material.transparent = true;
  top.material.opacity = .18;
  g.add(top);

  // horizon wave ribbons — long thin plane strips deformed by sine noise
  const waves = [];
  for (let i = 0; i < 5; i++){
    const geo = new THREE.PlaneGeometry(1100, 60, 160, 6);
    const m = new THREE.LineSegments(new THREE.WireframeGeometry(geo),
      wire(GHOST, .07 + i * 0.025));
    m.rotation.x = -Math.PI / 2 + 0.16;
    m.position.set(0, 6 + i * 7 - 45, -120 - i * 55);  // -45 world units ≈ 100px down
    m.userData.seed = i * 1.7;
    g.add(m);
    waves.push(m);
  }
  g.userData.waves = waves;
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
  aircraft:  'assets/synergy_full.glb',
  mountains: 'assets/rugged_mountain_landscape/rugged_mountain_landscape.gltf'
};
const gltfLoader = new THREE.GLTFLoader();
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
  root.traverse(o => {
    if (o.isMesh){
      o.material = new THREE.MeshBasicMaterial({
        color, wireframe:true, transparent:true, opacity,
        depthWrite:false, blending:THREE.AdditiveBlending
      });
    }
  });
}

function sceneCessnaTerrain(opts = {}){
  const hoverBase  = opts.hoverBase ?? 26;
  const aircraft   = opts.aircraft ?? true;        // show the Synergy aircraft?
  const terrainRot = opts.terrainRot ?? 0;         // degrees to spin the terrain to (animated)
  const floorRings = opts.floorRings ?? false;     // gold contour rings on the floor?
  const g = new THREE.Group();

  // --- mountains: rugged landscape gltf — full stage width, bottom 2/3,
  //     tilted down ~10% ---
  gltfLoader.load(GLTF_ASSETS.mountains, gltf => {
    const m = gltf.scene;
    wireframeify(m, 0x4D4D4D, .35);   // mountains in 30% gray
    // normalize: scale so model width spans the full stage
    let box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    m.scale.setScalar(1000 / size.x);
    // recentre, then rest the base on the floor plane (y = -46)
    box.setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    m.position.sub(c);
    const wrap = new THREE.Group();
    wrap.add(m);
    wrap.position.set(MOUNTAIN_OFFSET_X, -46 + (size.y * (1000 / size.x)) / 2, -80);  // pushed back behind the aircraft
    wrap.rotation.x = THREE.MathUtils.degToRad(0);  // tilt down 10%
    g.add(wrap);
    // animated rotation of the terrain around its centre axis (see app.js frame loop)
    if (terrainRot) g.userData.terrainSpin = { obj: wrap, target: THREE.MathUtils.degToRad(terrainRot) };
    console.log('mountains loaded, size:', size);
  }, undefined, gltfError(GLTF_ASSETS.mountains));

  // --- foreground: Synergy aircraft (solid body, from synergy.blend) ---
  const plane = new THREE.Group();
  if (aircraft){
  gltfLoader.load(GLTF_ASSETS.aircraft, gltf => {
    const jet = gltf.scene;
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
    plane.add(jet);
    console.log('aircraft loaded, size:', size);
  }, undefined, gltfError(GLTF_ASSETS.aircraft));
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
function sceneProtect(){ return sceneCessnaTerrain({ hoverBase: 28 }); }  // vertically centred
function sceneSlider(){  return sceneCessnaTerrain({ hoverBase: 28 }); }  // vertically centred

/* ==========================================================
   Scene 2 — INSPECT : tank hall + AR tablet overlay (accent)
   ========================================================== */
function sceneInspect(){  // VALIDATE: terrain only, rotated 150°
  return sceneCessnaTerrain({ aircraft:false, terrainRot:150 });
}

/* ==========================================================
   Scene 3 — SIMULATE : training cabin frame + seat (accent)
   ========================================================== */
function sceneSimulate(){ // TRAINING: terrain only, rotated 60+30=90°
  return sceneCessnaTerrain({ aircraft:false, terrainRot:90 });
}

/* ==========================================================
   Scene 4 — SCOUT : survey drone over contour terrain (accent)
   ========================================================== */
function sceneScout(){    // INVESTIGATE: terrain only, rotated 90+90=180°
  return sceneCessnaTerrain({ aircraft:false, terrainRot:180 });   // gold floor rings removed
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
    id:'slider', label:'Overture', title:'Innovation',
    body:'An interactive walkthrough of engineering ideas. Scroll, swipe, or use the arrow keys to move between scenes — replace this text with your own narrative.',
    copyPos:{ left:'381px', bottom:'200px' },   // <-- this scene's text position
    cuePos:{ bottom:'200px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[0, 30, 250], look:[0, 10, 0], build:sceneSlider
  },
  {
    id:'protect', label:'Protect', title:'Protect',
    body:'A compact sensing platform mounted on an all-terrain carrier, able to survey spaces that are difficult or unsafe for people to enter. Placeholder copy — swap in your own description.',
    copyPos:{ left:'400px', bottom:'200px' },   // <-- this scene's text position
    cuePos:{ bottom:'200px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[10, 46, 165], look:[6, 8, 0], build:sceneProtect
  },
  {
    id:'validate', label:'Validate', title:'Validate',
    body:'Overlaying live data onto complex installations so that inspection, traceability, and sign-off happen in one continuous pass. Placeholder copy — swap in your own description.',
    copyPos:{ left:'300px', bottom:'300px' },   // <-- this scene's text position
    cuePos:{ bottom:'200px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[-14, 34, 205], look:[8, 4, 0], build:sceneInspect
  },
  {
    id:'training', label:'Training', title:'Training',
    body:'A simulation cabin that lets operators rehearse demanding manoeuvres safely, long before they perform them on site. Placeholder copy — swap in your own description.',
    copyPos:{ left:'300px', bottom:'300px' },   // <-- this scene's text position
    cuePos:{ bottom:'200px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[36, 40, 235], look:[6, -4, 0], build:sceneSimulate
  },
  {
    id:'investigate', label:'Investigate', title:'Investigate',
    body:'Autonomous aerial survey across large sites — mapping, monitoring, and inspecting terrain from exploration through to rehabilitation. Placeholder copy — swap in your own description.',
    copyPos:{ left:'300px', bottom:'300px' },   // <-- this scene's text position
    cuePos:{ bottom:'200px' },                    // <-- this scene's \"scroll to discover\" position
    cam:[-26, 52, 210], look:[10, 6, 0], build:sceneScout
  }
];
