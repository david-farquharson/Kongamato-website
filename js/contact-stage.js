/* ==========================================================
   contact-stage.js — static WebGL background for contact.html
   Renders the same terrain scene used on the Training page
   (sceneSimulate), with gentle parallax + drift, no navigation.
   ========================================================== */

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x05070f, 1);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070f, 260, 760);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 2000);

const world = new THREE.Group();
scene.add(world);

const env = buildEnvironment();
world.add(env);

/* Build the Training scene's terrain + aircraft and reveal it. */
const g = sceneSimulate();
g.visible = true;
world.add(g);
if (g.userData.lazyLoad) g.userData.lazyLoad();

/* Training page camera framing. */
const TRAIN_CAM  = [36, 40, 235];
const TRAIN_LOOK = [6, -4, 0];
const camTarget = new THREE.Vector3(...TRAIN_CAM);
const lookAt    = new THREE.Vector3(...TRAIN_LOOK);
camera.position.set(TRAIN_CAM[0], TRAIN_CAM[1], TRAIN_CAM[2] + 220);   // fly-in
const camPos = new THREE.Vector3().copy(camera.position);

/* pointer parallax */
const pointer = new THREE.Vector2(0, 0);
const smooth  = new THREE.Vector2(0, 0);
addEventListener('pointermove', e => {
  pointer.x = (e.clientX / innerWidth - .5) * 2;
  pointer.y = (e.clientY / innerHeight - .5) * 2;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function frame(){
  const t = clock.elapsedTime;
  animateEnvironment(env, t);

  smooth.x += (pointer.x - smooth.x) * .045;
  smooth.y += (pointer.y - smooth.y) * .045;
  camPos.lerp(camTarget, .045);
  camera.position.set(camPos.x + smooth.x * 26, camPos.y - smooth.y * 14, camPos.z);
  camera.lookAt(lookAt);

  // terrain spin settle (same easing as the main experience)
  const spin = g.userData.terrainSpin;
  if (spin) spin.obj.rotation.y += (spin.target - spin.obj.rotation.y) * .035;

  const a = g.userData.accent;
  if (a && g.userData.hover){
    const base = g.userData.hoverBase ?? 26;
    g.userData.hover.position.y = base + Math.sin(t * .9) * 3;
  }
  g.rotation.x = Math.sin(t * .18) * .012;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
