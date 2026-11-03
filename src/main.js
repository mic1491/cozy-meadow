import * as THREE from 'three';
import { buildWorld, groundH, WORLD_RADIUS } from './world.js';
import { createHero } from './hero.js';
import { createInput } from './input.js';

const canvas = document.getElementById('game');
const hintEl = document.getElementById('hint');
const fpsEl = document.getElementById('fps');
const debug = new URLSearchParams(location.search).has('debug');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('err').style.display = 'flex';
  throw e;
}
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.NoToneMapping;

const SKY = 0xcdebff;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 32, 62);

scene.add(new THREE.HemisphereLight(0xe3f4ff, 0xb9dc8f, 1.55));
const sun = new THREE.DirectionalLight(0xfff1cc, 1.9);
sun.position.set(-12, 20, 9);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 120);
const PITCH = THREE.MathUtils.degToRad(52);

const world = buildWorld(scene);
const hero = createHero();
scene.add(hero.root);
hero.root.position.set(0, groundH(0, 0), 0);

const input = createInput(canvas);

// camera follow
let zoom = 13, zoomTarget = 13;
const camFocus = new THREE.Vector3(0, 0.8, 0);
function placeCamera(snap, dt) {
  const target = new THREE.Vector3(hero.root.position.x, hero.root.position.y + 0.9, hero.root.position.z);
  if (snap) camFocus.copy(target);
  else camFocus.lerp(target, 1 - Math.exp(-5.5 * dt));
  camera.position.set(camFocus.x, camFocus.y + Math.sin(PITCH) * zoom, camFocus.z + Math.cos(PITCH) * zoom);
  camera.lookAt(camFocus);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 直立的手機畫面比較窄,把視野拉寬一點
  camera.fov = w / h < 0.8 ? 46 : 38;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// movement
const vel = new THREE.Vector2();
const SPEED = 4.4;
const PR = 0.4;
let hintHidden = false;
let moved = 0;

function update(dt, time) {
  zoomTarget = THREE.MathUtils.clamp(zoomTarget + input.takeZoom(), 9, 20);
  zoom += (zoomTarget - zoom) * (1 - Math.exp(-8 * dt));

  const m = input.poll(); // x: 右, y: 下(螢幕向下 = 世界 +z)
  const want = new THREE.Vector2(m.x, m.y).multiplyScalar(SPEED);
  vel.lerp(want, 1 - Math.exp(-10 * dt));

  const p = hero.root.position;
  p.x += vel.x * dt;
  p.z += vel.y * dt;

  for (const o of world.obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, min = o.r + PR;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.0001;
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
    }
  }
  const dist = Math.hypot(p.x, p.z);
  if (dist > WORLD_RADIUS) { p.x *= WORLD_RADIUS / dist; p.z *= WORLD_RADIUS / dist; }

  const targetY = groundH(p.x, p.z);
  p.y += (targetY - p.y) * (1 - Math.exp(-18 * dt));

  const speed = vel.length();
  hero.update(dt, time, vel, speed / SPEED);

  moved += speed * dt;
  if (!hintHidden && moved > 6) { hintHidden = true; hintEl.classList.add('hide'); }
}

// 簡單的效能自動調整:太卡就降低解析度
let frames = 0, acc = 0, lastCheck = 0, fpsAcc = 0, fpsFrames = 0;
function adaptQuality(dt, time) {
  frames++; acc += dt;
  if (time - lastCheck > 2.5 && frames > 20) {
    const avg = acc / frames;
    if (avg > 0.026 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.5);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
    frames = 0; acc = 0; lastCheck = time;
  }
}

const clock = new THREE.Clock();
placeCamera(true, 0);
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  update(dt, time);
  placeCamera(false, dt);
  renderer.render(scene, camera);
  adaptQuality(dt, time);
  if (debug) {
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc > 0.5) {
      fpsEl.style.display = 'block';
      fpsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps · ${renderer.info.render.calls} calls · ${Math.round(renderer.info.render.triangles / 1000)}k tri · x${pixelRatio}`;
      fpsAcc = 0; fpsFrames = 0;
    }
  }
});

window.__game = { hero, camera, input, renderer };
