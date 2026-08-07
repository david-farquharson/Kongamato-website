/* ==========================================================
   app.js — experience controller
   · WebGL stage with scroll/keyboard/touch scene navigation
   · Per-letter title reveals, pulsing DOM hotspots
   · Camera easing, glitch-style transition burst
   ========================================================== */

/* Classic script — expects globals: THREE, SCENES, buildEnvironment, animateEnvironment */

/* ---------------- renderer / camera ---------------- */
const stage = document.getElementById('stage');
// Adaptive renderer (see perf.js): MSAA + pixel ratio + fps are tuned to the
// detected GPU tier so Intel integrated machines stay smooth.
const renderer = PERF.makeRenderer();
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x05070f, 1);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070f, 240, 1600);   // soft, far — lets the mountain range recede without fogging out

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

// apply the current theme to the renderer/scene (and future toggles)
if (window.THEME) THEME.attach(renderer, scene);

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
const osOverlay = document.getElementById('osscroll');

/* 3s intro reveal, replayed on each scene: the terrain starts zoomed in ~50%
   and swung 45° horizontally, then smoothly eases to the resting framing.
   Driven in the render loop (real 3D) via revealClock; skipped with ?nointro. */
const noIntro = /[?&]nointro/.test(location.search);
const REVEAL_SECS = 3;
let revealT = noIntro ? REVEAL_SECS : REVEAL_SECS;   // seconds elapsed (>=SECS ⇒ done)
function playSceneReveal(){ if (!noIntro) revealT = 0; }
const easeOutCubic = x => 1 - Math.pow(1 - x, 3);

/* open_source scene: toggle the scrollable long-form overlay */
function setOSOverlay(id){
  const isOS = id === 'open_source';
  osOverlay.classList.toggle('open', isOS);
  if (isOS) osOverlay.scrollTop = 0;
  copyEl.style.display = isOS ? 'none' : '';   // overlay carries its own hero text
  // "scroll to discover" cue + rail: only on the open_source page
  document.querySelector('.scroll-cue').style.display = isOS ? '' : 'none';
  // CFD image: only on the design_studio page
  document.getElementById('studio-img').classList.toggle('show', id === 'design_studio');
}

/* scene counter: current page (gold) — next page (dim), rolling animation */
const counterEl = document.querySelector('.counter');
function setCounter(n){
  counterEl.querySelector('.cur b').textContent = String(n + 1).padStart(2, '0');
  // right number = total page count (menu length: scenes + Contact) — stays fixed
  counterEl.querySelector('.nxt b').textContent = String(SCENES.length + 1).padStart(2, '0');
  counterEl.classList.remove('roll');
  void counterEl.offsetWidth;              // restart the animation
  counterEl.classList.add('roll');
}

/* localized title/body for a scene (i18n.js provides window.sceneText;
   fall back to the English source in SCENES if i18n hasn't loaded yet) */
function textFor(def){
  return (typeof window.sceneText === 'function') ? window.sceneText(def)
                                                  : { title: def.title, body: def.body };
}

/* build menu (rebuildable so language switches update the labels) */
const menuList = document.querySelector('.menu ol');
function buildMenu(){
  menuList.innerHTML = '';
  SCENES.forEach((def, i) => {
    const li = document.createElement('li');
    const t = textFor(def).title;
    li.innerHTML = `<a href="#${def.id}">${t}</a>`;
    li.querySelector('a').onclick = e => {
      e.preventDefault();
      document.body.classList.remove('menu-open');
      go(i);
    };
    menuList.appendChild(li);
  });
  // Page 6 — Contact (a separate page, so a real link, not a scene jump)
  const contactLi = document.createElement('li');
  const contactLabel = (typeof window.i18nContactLabel === 'string') ? window.i18nContactLabel : 'Contact';
  contactLi.innerHTML = `<a href="contact.html">${contactLabel}</a>`;
  menuList.appendChild(contactLi);
}
buildMenu();
window.rerenderMenu = buildMenu;

/* re-apply the current scene's copy (called by i18n.js on language switch) */
window.rerenderCopy = function(){
  setCopy(SCENES[index]);
  const ov = document.getElementById('osscroll');
  // keep the overlay open state consistent after its HTML was swapped
  setOSOverlay(SCENES[index].id);
};

/* ---------------- title: split into animated letters ---------------- */
function setCopy(def){
  const loc = textFor(def);
  titleEl.innerHTML = '';
  [...loc.title].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch === ' ' ? '\u00A0' : ch;
    s.style.transitionDelay = (0.12 + i * 0.045) + 's';
    titleEl.appendChild(s);
  });
  bodyEl.innerHTML = loc.body;   // innerHTML so <br> etc. in body text render properly
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
    if (to.userData.lazyLoad) to.userData.lazyLoad();   // fetch/decode models on first visit
    playSceneReveal();                      // replay the zoom/rotate reveal for this scene
    to.rotation.y = dir * 0.5;              // enter offset, eased back to 0
    to.position.y = -dir * 26;

    const def = SCENES[n];
    camTarget.set(...def.cam);
    lookAt.set(...def.look);
    setCopy(def);
    setHotspots(def, to);
    setOSOverlay(def.id);

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
  if (osOverlay.classList.contains('open')) return;   // overlay scrolls natively
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

/* "Scroll to discover" cue: scroll the overlay, or advance scene */
document.getElementById('cue-link').onclick = e => {
  e.preventDefault();
  if (osOverlay.classList.contains('open')) osOverlay.scrollBy({ top: innerHeight * 0.85, behavior:'smooth' });
  else go((index + 1) % SCENES.length, 1);
};

document.getElementById('ctrl-prev').onclick = () => go(index - 1, -1);
document.getElementById('ctrl-next').onclick = () => {
  // last scene → Contact page (#6); otherwise advance to the next scene
  if (index === SCENES.length - 1) location.href = 'contact.html';
  else go(index + 1, 1);
};

/* ---------------- resize ---------------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------------- render loop ---------------- */
const clock = new THREE.Clock();

function frame(now){
  requestAnimationFrame(frame);
  if (!PERF.gate(now)) return;              // fps cap on low-end GPUs

  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;

  animateEnvironment(env, t);

  // intro reveal progress (0..1): 1 = settled at rest
  if (revealT < REVEAL_SECS) revealT += dt;
  const rk = easeOutCubic(Math.min(1, revealT / REVEAL_SECS));
  const revealRot  = (1 - rk) * (Math.PI / 8);   // 22.5° swing → 0
  const revealZoom = (1 - rk) * 0.42;            // dolly 42% toward the scene → 0

  // camera easing toward target + parallax
  smooth.x += (pointer.x - smooth.x) * .045;
  smooth.y += (pointer.y - smooth.y) * .045;
  camPos.lerp(camTarget, .045);
  camera.position.set(
    camPos.x + smooth.x * 26,
    camPos.y - smooth.y * 14,
    camPos.z
  );
  if (revealZoom > 0) camera.position.lerp(lookAt, revealZoom);   // zoom-in on reveal
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

    // intro reveal: swing the terrain 45° → rest (real 3D rotation)
    if (g.userData.terrainWrap) g.userData.terrainWrap.rotation.y = revealRot;

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
}

/* ---------------- boot ---------------- */
function boot(){
  const loader = document.querySelector('.loader');
  const bar = loader.querySelector('.bar i');
  const pct = loader.querySelector('.pct');
  // ?nointro skips the loading animation (used for screenshots/tests)
  const fast = /[?&]nointro/.test(location.search);
  if (fast) loader.style.display = 'none';
  let p = 0;
  const tick = fast ? null : setInterval(() => {
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
  if (groups[start].userData.lazyLoad) groups[start].userData.lazyLoad();
  const def = SCENES[start];
  camTarget.set(...def.cam);
  camPos.set(def.cam[0], def.cam[1], def.cam[2] + 220);   // fly-in
  lookAt.set(...def.look);
  setCopy(def);
  setHotspots(def, groups[start]);
  setOSOverlay(def.id);
  setCounter(start);
  updateNav();
  setTimeout(() => copyEl.classList.add('in'), 900);

  playSceneReveal();              // intro reveal on first load
  requestAnimationFrame(frame);   // rAF supplies the timestamp the fps gate needs
}
boot();
