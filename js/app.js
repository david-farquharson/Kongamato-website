/* ==========================================================
   app.js — experience controller
   · WebGL stage with scroll/keyboard/touch scene navigation
   · Per-letter title reveals, pulsing DOM hotspots
   · Camera easing, glitch-style transition burst
   ========================================================== */

/* Classic script — expects globals: THREE, SCENES, buildEnvironment, animateEnvironment */

/* ---------------- renderer / camera ---------------- */
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x05070f, 1);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070f, 260, 760);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 2000);
camera.position.set(0, 30, 250);

const world = new THREE.Group();
scene.add(world);

const env = buildEnvironment();
world.add(env);

/* ---------------- build all scenes ---------------- */
const groups = SCENES.map(def => {
  const g = def.build();
  g.visible = false;
  world.add(g);
  return g;
});

/* ---------------- state ---------------- */
let index = 0;
let animating = false;
const pointer = new THREE.Vector2(0, 0);   // parallax target
const smooth  = new THREE.Vector2(0, 0);
const camPos  = new THREE.Vector3().copy(camera.position);
const camTarget = new THREE.Vector3(0, 10, 0);
const lookAt  = new THREE.Vector3(0, 10, 0);
let glitch = 0;

/* ---------------- DOM refs ---------------- */
const copyEl   = document.querySelector('.copy');
const titleEl  = copyEl.querySelector('h1');
const bodyEl   = copyEl.querySelector('p');
const hotLayer = document.getElementById('hotspots');

/* scene counter: current page (gold) — next page (dim), rolling animation */
const counterEl = document.querySelector('.counter');
function setCounter(n){
  counterEl.querySelector('.cur b').textContent = String(n + 1).padStart(2, '0');
  counterEl.querySelector('.nxt b').textContent = String((n + 1) % SCENES.length + 1).padStart(2, '0');
  counterEl.classList.remove('roll');
  void counterEl.offsetWidth;              // restart the animation
  counterEl.classList.add('roll');
}

/* build menu */
const menuList = document.querySelector('.menu ol');
SCENES.forEach((def, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<a href="#${def.id}">${def.title}</a>`;
  li.querySelector('a').onclick = e => {
    e.preventDefault();
    document.body.classList.remove('menu-open');
    go(i);
  };
  menuList.appendChild(li);
});

/* ---------------- title: split into animated letters ---------------- */
function setCopy(def){
  titleEl.innerHTML = '';
  [...def.title].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch === ' ' ? '\u00A0' : ch;
    s.style.transitionDelay = (0.12 + i * 0.045) + 's';
    titleEl.appendChild(s);
  });
  bodyEl.textContent = def.body;
  // per-scene placement of the .copy block (falls back to style.css .copy)
  const p = def.copyPos || {};
  copyEl.style.left     = p.left     ?? '';
  copyEl.style.right    = p.right    ?? '';
  copyEl.style.top      = p.top      ?? '';
  copyEl.style.bottom   = p.bottom   ?? '';
  copyEl.style.maxWidth = p.maxWidth ?? '';
  // per-scene placement of the "scroll to discover" cue + rail
  const cue = document.querySelector('.cue-inner');
  const c = def.cuePos || {};
  cue.style.left   = c.left   ?? '';
  cue.style.right  = c.right  ?? '';
  cue.style.top    = c.top    ?? '';
  cue.style.bottom = c.bottom ?? '';
}

/* ---------------- hotspots ---------------- */
function setHotspots(def, g){
  hotLayer.innerHTML = '';
  (g.userData.hotspots || []).forEach(([nx, ny], i) => {
    const d = document.createElement('div');
    d.className = 'hotspot';
    d.style.left = (50 + nx * 50) + '%';
    d.style.top  = (50 - ny * 50) + '%';
    d.style.animationDelay = (i * 0.5) + 's';
    d.innerHTML = '<i></i>';
    hotLayer.appendChild(d);
  });
}

/* ---------------- navigation ---------------- */
function go(n, dir = 1){
  if (animating || n === index || n < 0 || n >= SCENES.length) return;
  animating = true;
  glitch = 1;

  const from = groups[index], to = groups[n];
  copyEl.classList.remove('in');
  copyEl.classList.add('out');
  hotLayer.classList.add('hide');

  // swap models mid-transition
  setTimeout(() => {
    from.visible = false;
    to.visible = true;
    to.rotation.y = dir * 0.5;              // enter offset, eased back to 0
    to.position.y = -dir * 26;

    const def = SCENES[n];
    camTarget.set(...def.cam);
    lookAt.set(...def.look);
    setCopy(def);
    setHotspots(def, to);

    copyEl.classList.remove('out');
    copyEl.classList.add('in');
    hotLayer.classList.remove('hide');
  }, 430);

  index = n;
  setCounter(n);
  updateNav();
  history.replaceState(null, '', '#' + SCENES[n].id);

  setTimeout(() => animating = false, 1000);
}

/* wheel */
let lock = false;
addEventListener('wheel', e => {
  if (lock || Math.abs(e.deltaY) < 18) return;
  lock = true; setTimeout(() => lock = false, 950);
  const d = e.deltaY > 0 ? 1 : -1;
  go(index + d, d);
}, { passive:true });

/* keyboard */
addEventListener('keydown', e => {
  if (['ArrowDown','ArrowRight','PageDown',' '].includes(e.key)) go(index + 1, 1);
  if (['ArrowUp','ArrowLeft','PageUp'].includes(e.key))          go(index - 1, -1);
  if (e.key === 'Escape') document.body.classList.remove('menu-open');
});

/* touch */
let ty = null;
addEventListener('touchstart', e => ty = e.touches[0].clientY, { passive:true });
addEventListener('touchend', e => {
  if (ty === null) return;
  const dy = ty - e.changedTouches[0].clientY;
  if (Math.abs(dy) > 46){ const d = dy > 0 ? 1 : -1; go(index + d, d); }
  ty = null;
}, { passive:true });

/* pointer parallax */
addEventListener('pointermove', e => {
  pointer.x = (e.clientX / innerWidth - .5) * 2;
  pointer.y = (e.clientY / innerHeight - .5) * 2;
});

/* HUD buttons */
document.querySelector('.burger').onclick = () =>
  document.body.classList.toggle('menu-open');
document.querySelector('.top-right .label').onclick = () =>
  document.body.classList.toggle('menu-open');
/* hide the prev arrow on the first page */
function updateNav(){
  document.getElementById('ctrl-prev').style.visibility = index === 0 ? 'hidden' : 'visible';
}

document.getElementById('ctrl-prev').onclick = () => go(index - 1, -1);
document.getElementById('ctrl-next').onclick = () => go((index + 1) % SCENES.length, 1);  // wraps to first page

/* ---------------- resize ---------------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------------- render loop ---------------- */
const clock = new THREE.Clock();

function frame(){
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;

  animateEnvironment(env, t);

  // camera easing toward target + parallax
  smooth.x += (pointer.x - smooth.x) * .045;
  smooth.y += (pointer.y - smooth.y) * .045;
  camPos.lerp(camTarget, .045);
  camera.position.set(
    camPos.x + smooth.x * 26,
    camPos.y - smooth.y * 14,
    camPos.z
  );
  camera.lookAt(lookAt);

  // glitch burst on transition: subtle camera roll + fov kick
  if (glitch > 0){
    glitch = Math.max(0, glitch - dt * 2.6);
    const k = glitch * glitch;
    camera.rotation.z += (Math.random() - .5) * .018 * k;
    camera.fov = 48 + k * 3.5;
    camera.updateProjectionMatrix();
  }

  // per-scene motion
  groups.forEach((g, i) => {
    // terrain rotation transition: ease toward target while the scene is
    // active, reset to 0 when leaving so it re-animates on each visit
    const spin = g.userData.terrainSpin;
    if (spin){
      if (!g.visible) spin.obj.rotation.y = 0;
      else spin.obj.rotation.y += (spin.target - spin.obj.rotation.y) * .035;
    }
    if (!g.visible) return;
    g.rotation.y += (0 - g.rotation.y) * .05;      // settle entry offset
    g.position.y += (0 - g.position.y) * .06;

    const a = g.userData.accent;
    if (a){
      if (g.userData.spinAll) { a.rotation.y += .0035; a.rotation.x += .0012; }
      else if (a.userData.spin) a.rotation.y += .006;
      if (g.userData.hover){
        const base = g.userData.hoverBase ?? 26;
        g.userData.hover.position.y = base + Math.sin(t * .9) * 3;
      }
    }
    // slow world drift so the wireframe never feels static
    g.rotation.x = Math.sin(t * .18 + i) * .012;
  });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */
function boot(){
  const loader = document.querySelector('.loader');
  const bar = loader.querySelector('.bar i');
  const pct = loader.querySelector('.pct');
  let p = 0;
  const tick = setInterval(() => {
    p = Math.min(100, p + 6 + Math.random() * 12);
    bar.style.right = (100 - p) + '%';
    pct.textContent = String(Math.floor(p)).padStart(3, '0') + ' %';
    if (p >= 100){
      clearInterval(tick);
      setTimeout(() => loader.classList.add('done'), 350);
    }
  }, 90);

  // open on hash if present
  const hash = location.hash.slice(1);
  const start = Math.max(0, SCENES.findIndex(s => s.id === hash));
  index = start;
  groups[start].visible = true;
  const def = SCENES[start];
  camTarget.set(...def.cam);
  camPos.set(def.cam[0], def.cam[1], def.cam[2] + 220);   // fly-in
  lookAt.set(...def.look);
  setCopy(def);
  setHotspots(def, groups[start]);
  setCounter(start);
  updateNav();
  setTimeout(() => copyEl.classList.add('in'), 900);

  frame();
}
boot();
