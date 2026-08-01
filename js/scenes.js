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
  aircraft:  'assets/synergy_aircraft_synergy/synergy.gltf',
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
  const hoverBase = opts.hoverBase ?? 26;
  const g = new THREE.Group();

  // --- mountains: rugged landscape gltf — full stage width, bottom 2/3,
  //     tilted down ~10% ---
  gltfLoader.load(GLTF_ASSETS.mountains, gltf => {
    const m = gltf.scene;
    wireframeify(m, GHOST, .22);
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
    wrap.position.set(MOUNTAIN_OFFSET_X, -46 + (size.y * (1000 / size.x)) / 2, -20);
    wrap.rotation.x = THREE.MathUtils.degToRad(0);  // tilt down 10%
    g.add(wrap);
    console.log('mountains loaded, size:', size);
  }, undefined, gltfError(GLTF_ASSETS.mountains));

  // --- foreground: Synergy aircraft gltf (wireframe) ---
  const plane = new THREE.Group();
  gltfLoader.load(GLTF_ASSETS.aircraft, gltf => {
    const jet = gltf.scene;
    // strip everything that isn't the aircraft itself:
    // "Synergy Aircraft" lettering (Text*), floor panel (Plane_0),
    // and the three 25-unit decorative booms (Cylinder007/008/009)
    const junk = [];
    jet.traverse(o => {
      if (o.isMesh && /^(Text|Plane_0|Cylinder00[789])/.test(o.name)) junk.push(o);
    });
    junk.forEach(o => { o.parent.remove(o); o.geometry.dispose(); });
    wireframeify(jet, 0xFFB81C, .5);   // aircraft in RGB(255, 184, 28)
    // normalize: longest side = 210 world units, centred
    const box = new THREE.Box3().setFromObject(jet);
    const size = box.getSize(new THREE.Vector3());
    jet.scale.setScalar(210 / Math.max(size.x, size.y, size.z));
    box.setFromObject(jet);
    jet.position.sub(box.getCenter(new THREE.Vector3()));
    // isometric orientation to match previous staging
    jet.rotation.order = 'YXZ';
    jet.rotation.y = THREE.MathUtils.degToRad(335);
    jet.rotation.x = THREE.MathUtils.degToRad(10);
    plane.add(jet);
    console.log('aircraft loaded, size:', size);
  }, undefined, gltfError(GLTF_ASSETS.aircraft));
  plane.position.set(4, 10, 0);
  g.add(plane);
  g.userData.accent = plane;
  g.userData.hover = plane;
  g.userData.hoverBase = hoverBase;

  g.userData.hotspots = [[-0.10, 0.12], [0.14, -0.02]];
  return g;
}
function sceneProtect(){ return sceneCessnaTerrain({ hoverBase: 62 }); }  // +36 world units ≈ 200px up
function sceneSlider(){  return sceneCessnaTerrain({ hoverBase: 65 }); }  // +55 world units ≈ 200px up

/* ==========================================================
   Scene 2 — INSPECT : tank hall + AR tablet overlay (accent)
   ========================================================== */
function sceneInspect(){
  const g = new THREE.Group();

  // horizontal vessel bank
  const vessels = new THREE.Group();
  for (let i = 0; i < 4; i++){
    const v = mesh(new THREE.CylinderGeometry(17, 17, 20, 24, 2), GHOST, .22);
    v.rotation.z = Math.PI / 2;
    v.position.x = -30 + i * 21;
    vessels.add(v);
  }
  g.add(vessels);

  // silo towers in the distance
  [-120, -86, 96, 128].forEach((x, i) => {
    const s = mesh(new THREE.CylinderGeometry(13, 13, 60 + i * 8, 18, 4), GHOST, .14);
    s.position.set(x, 6, -70 - i * 10);
    g.add(s);
  });

  // accent: floating AR tablet frame with UI blocks
  const ui = new THREE.Group();
  ui.add(edges(new THREE.PlaneGeometry(96, 62), ACCENT, .95));
  for (let i = 0; i < 4; i++){
    const chip = edges(new THREE.PlaneGeometry(11, 7), ACCENT, .8);
    chip.position.set(-38, 20 - i * 12, .4);
    ui.add(chip);
  }
  const panelA = edges(new THREE.PlaneGeometry(26, 24), ACCENT, .85);
  panelA.position.set(31, 12, .4);
  ui.add(panelA);
  const panelB = edges(new THREE.PlaneGeometry(26, 16), ACCENT, .85);
  panelB.position.set(31, -14, .4);
  ui.add(panelB);
  ui.rotation.set(0.05, -0.32, 0.045);
  ui.position.set(16, 4, 34);
  g.add(ui);
  g.userData.accent = ui;

  g.userData.hotspots = [[0.02, 0.22], [0.14, -0.02], [0.22, 0.10]];
  return g;
}

/* ==========================================================
   Scene 3 — SIMULATE : training cabin frame + seat (accent)
   ========================================================== */
function sceneSimulate(){
  const g = new THREE.Group();

  // outer room shell — open box built from edge frames
  const shell = new THREE.Group();
  shell.add(edges(new THREE.BoxGeometry(120, 96, 110), ACCENT, .85));
  shell.add(edges(new THREE.BoxGeometry(119, 1, 109), ACCENT, .6)); // mid rail
  const ghostShell = mesh(new THREE.BoxGeometry(126, 100, 116, 5, 4, 5), GHOST, .12);
  shell.add(ghostShell);
  g.add(shell);

  // platform
  const plat = edges(new THREE.BoxGeometry(70, 3, 60), ACCENT, .75);
  plat.position.y = -44;
  g.add(plat);

  // accent: operator seat
  const seat = new THREE.Group();
  seat.add(mesh(new THREE.BoxGeometry(26, 6, 26, 5, 2, 5), ACCENT, .9));          // base
  const back = mesh(new THREE.CylinderGeometry(13, 16, 46, 16, 6, true), ACCENT, .9);
  back.position.set(0, 25, -9);
  back.rotation.x = -0.13;
  seat.add(back);
  [-17, 17].forEach(x => {                                                        // armrests
    const a = mesh(new THREE.BoxGeometry(5, 3, 22, 2, 1, 4), ACCENT, .8);
    a.position.set(x, 9, 2);
    seat.add(a);
  });
  const stick = mesh(new THREE.SphereGeometry(3.4, 10, 8), ACCENT, .95);
  stick.position.set(-17, 14, 6);
  seat.add(stick);
  seat.position.set(6, -28, 6);
  g.add(seat);
  g.userData.accent = seat;

  g.userData.hotspots = [[0.10, 0.14], [-0.08, -0.02], [0.02, -0.14]];
  return g;
}

/* ==========================================================
   Scene 4 — SCOUT : survey drone over contour terrain (accent)
   ========================================================== */
function sceneScout(){
  const g = new THREE.Group();

  // contour "map" rings on the floor plane
  const contours = new THREE.Group();
  for (let i = 0; i < 9; i++){
    const pts = [];
    const R = 26 + i * 15, N = 74;
    for (let a = 0; a <= N; a++){
      const th = (a / N) * Math.PI * 2;
      const wob = Math.sin(th * 3 + i) * 9 + Math.sin(th * 7 - i * 2) * 4;
      pts.push(new THREE.Vector3(Math.cos(th) * (R + wob), 0, Math.sin(th) * (R + wob) * .7));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      wire(ACCENT, .30 - i * 0.022));
    contours.add(line);
  }
  contours.position.y = -44;
  g.add(contours);

  // accent: drone
  const drone = new THREE.Group();
  const fus = mesh(new THREE.CapsuleGeometry(11, 34, 8, 18), ACCENT, .9);
  fus.rotation.z = Math.PI / 2;
  drone.add(fus);
  const sensor = mesh(new THREE.SphereGeometry(9, 14, 10), ACCENT, .9);
  sensor.position.set(4, -14, 0);
  drone.add(sensor);
  // rotor booms (long crossing rails)
  [[1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(([sx, sz]) => {
    const boom = mesh(new THREE.BoxGeometry(150, 2.4, 4, 22, 1, 1), ACCENT, .8);
    boom.rotation.y = Math.atan2(sz, sx) + Math.PI / 4;
    boom.position.y = 6;
    drone.add(boom);
  });
  // landing skids
  [-1, 1].forEach(s => {
    const leg = mesh(new THREE.BoxGeometry(2.4, 42, 2.4, 1, 5, 1), ACCENT, .75);
    leg.position.set(s * 16, -32, s * 8);
    leg.rotation.z = s * 0.22;
    drone.add(leg);
    const skid = mesh(new THREE.BoxGeometry(2.6, 2.6, 56, 1, 1, 7), ACCENT, .75);
    skid.position.set(s * 20, -52, s * 8);
    drone.add(skid);
  });
  drone.position.set(14, 26, 0);
  drone.rotation.set(0.12, 0.5, -0.16);
  g.add(drone);
  g.userData.accent = drone;
  g.userData.hover = drone;

  g.userData.hotspots = [[-0.12, 0.10], [0.02, -0.06]];
  return g;
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
    cam:[0, 30, 250], look:[0, 10, 0], build:sceneSlider
  },
  {
    id:'protect', label:'Protect', title:'Protect',
    body:'A compact sensing platform mounted on an all-terrain carrier, able to survey spaces that are difficult or unsafe for people to enter. Placeholder copy — swap in your own description.',
    cam:[10, 46, 165], look:[6, 8, 0], build:sceneProtect
  },
  {
    id:'validate', label:'Validate', title:'Validate',
    body:'Overlaying live data onto complex installations so that inspection, traceability, and sign-off happen in one continuous pass. Placeholder copy — swap in your own description.',
    cam:[-14, 34, 205], look:[8, 4, 0], build:sceneInspect
  },
  {
    id:'training', label:'Training', title:'Training',
    body:'A simulation cabin that lets operators rehearse demanding manoeuvres safely, long before they perform them on site. Placeholder copy — swap in your own description.',
    cam:[36, 40, 235], look:[6, -4, 0], build:sceneSimulate
  },
  {
    id:'investigate', label:'Investigate', title:'Investigate',
    body:'Autonomous aerial survey across large sites — mapping, monitoring, and inspecting terrain from exploration through to rehabilitation. Placeholder copy — swap in your own description.',
    cam:[-26, 52, 210], look:[10, 6, 0], build:sceneScout
  }
];
