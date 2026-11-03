import * as THREE from 'three';
import { blobTexture } from './hero.js';

export const WORLD_RADIUS = 30;
const GROUND_SIZE = 130;

// 固定亂數種子,讓每次進來的草地長得一樣(之後每日刷新再換種子)
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 緩緩起伏的丘陵
export function groundH(x, z) {
  const flat = Math.min(1, Math.hypot(x, z) / 5); // 出生點附近比較平
  return flat * (0.42 * Math.sin(x * 0.17 + 1.3) * Math.cos(z * 0.14) + 0.2 * Math.sin(x * 0.37 + z * 0.29) + 0.15);
}

const tmp = new THREE.Object3D();
const col = new THREE.Color();

function instanced(geo, material, count) {
  const m = new THREE.InstancedMesh(geo, material, count);
  m.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  m.frustumCulled = false;
  return m;
}

export function buildWorld(scene) {
  const rand = rng(20261103);
  const range = (a, b) => a + (b - a) * rand();
  const obstacles = [];

  // ---- 地面 ----
  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c1 = new THREE.Color(0x9be564), c2 = new THREE.Color(0x6fcf7f), c3 = new THREE.Color(0xb6ee73);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.23 + Math.sin(x * 0.11) * 2);
    col.copy(c2).lerp(c1, n);
    col.lerp(c3, Math.max(0, Math.sin(x * 0.5 + z * 0.43)) * 0.18);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));

  const blobs = [];
  const place = (minR) => {
    for (let i = 0; i < 20; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (WORLD_RADIUS + 14);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x, z) > minR) return { x, z };
    }
    return { x: 20, z: 20 };
  };

  // ---- 草叢(大量,實例化繪製)----
  const GRASS = 7000;
  const grass = instanced(new THREE.ConeGeometry(0.06, 0.3, 4, 1), new THREE.MeshLambertMaterial(), GRASS);
  const gA = new THREE.Color(0x7edc6a), gB = new THREE.Color(0xa8ee78), gC = new THREE.Color(0x7fd98a);
  for (let i = 0; i < GRASS; i++) {
    const { x, z } = place(1.2);
    const s = range(0.7, 1.5);
    tmp.position.set(x, groundH(x, z) + 0.13 * s, z);
    tmp.rotation.set(range(-0.35, 0.35), range(0, 6.28), range(-0.35, 0.35));
    tmp.scale.set(s, s * range(0.8, 1.4), s);
    tmp.updateMatrix();
    grass.setMatrixAt(i, tmp.matrix);
    const t = rand();
    col.copy(t < 0.4 ? gA : t < 0.75 ? gB : gC);
    grass.setColorAt(i, col);
  }
  scene.add(grass);

  // ---- 花(一叢一叢,疏密不均)----
  const petals = [0xff9ebb, 0xffd95e, 0xffffff, 0xc6a8ff, 0xff8f7a];
  const patches = [];
  for (let i = 0; i < 16; i++) {
    const p = place(4);
    patches.push({ ...p, r: range(1.6, 3.6), n: Math.floor(range(10, 30)), c: petals[Math.floor(rand() * petals.length)] });
  }
  const flowers = [];
  for (const p of patches) {
    for (let i = 0; i < p.n; i++) {
      const a = rand() * 6.28, r = Math.pow(rand(), 0.7) * p.r;
      flowers.push({ x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, c: rand() < 0.7 ? p.c : petals[Math.floor(rand() * petals.length)] });
    }
  }
  for (let i = 0; i < 90; i++) { // 零星散落的
    const p = place(3);
    flowers.push({ ...p, c: petals[Math.floor(rand() * petals.length)] });
  }
  const stems = instanced(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 5), new THREE.MeshLambertMaterial({ color: 0x4fbf8a }), flowers.length);
  const blooms = instanced(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshLambertMaterial(), flowers.length);
  const hearts = instanced(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe27a }), flowers.length);
  flowers.forEach((f, i) => {
    const s = range(0.8, 1.35), y = groundH(f.x, f.z);
    tmp.rotation.set(0, 0, 0);
    tmp.position.set(f.x, y + 0.2 * s, f.z); tmp.scale.setScalar(s); tmp.updateMatrix();
    stems.setMatrixAt(i, tmp.matrix);
    tmp.position.set(f.x, y + 0.43 * s, f.z); tmp.scale.set(s, s * 0.55, s); tmp.updateMatrix();
    blooms.setMatrixAt(i, tmp.matrix);
    blooms.setColorAt(i, col.set(f.c));
    tmp.position.set(f.x, y + 0.5 * s, f.z); tmp.scale.setScalar(s); tmp.updateMatrix();
    hearts.setMatrixAt(i, tmp.matrix);
  });
  scene.add(stems, blooms, hearts);

  // ---- 樹(三個小樹林加幾棵獨立的)----
  const groves = [place(10), place(10), place(10)].map((p) => ({ ...p, r: range(4, 7), n: Math.floor(range(5, 9)) }));
  const trees = [];
  for (const g of groves) {
    for (let i = 0; i < g.n; i++) {
      const a = rand() * 6.28, r = Math.sqrt(rand()) * g.r;
      trees.push({ x: g.x + Math.cos(a) * r, z: g.z + Math.sin(a) * r, s: range(0.8, 1.35) });
    }
  }
  for (let i = 0; i < 7; i++) trees.push({ ...place(7), s: range(0.7, 1.1) });
  const good = [];
  for (const t of trees) {
    if (Math.hypot(t.x, t.z) < 6) continue;
    if (good.some((o) => Math.hypot(o.x - t.x, o.z - t.z) < 1.8)) continue;
    good.push(t);
  }
  const trunks = instanced(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8), new THREE.MeshLambertMaterial({ color: 0xb98a63 }), good.length);
  const leaves1 = instanced(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshLambertMaterial(), good.length);
  const leaves2 = instanced(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshLambertMaterial(), good.length);
  const leafCols = [0x4fbf8a, 0x5fcf7a, 0x46b48f, 0x7ad46f];
  good.forEach((t, i) => {
    const y = groundH(t.x, t.z), s = t.s;
    tmp.rotation.set(0, 0, 0);
    tmp.position.set(t.x, y + 0.7 * s, t.z); tmp.scale.setScalar(s); tmp.updateMatrix();
    trunks.setMatrixAt(i, tmp.matrix);
    tmp.position.set(t.x, y + 2.15 * s, t.z); tmp.scale.set(1.25 * s, 1.1 * s, 1.25 * s); tmp.updateMatrix();
    leaves1.setMatrixAt(i, tmp.matrix);
    tmp.position.set(t.x + 0.35 * s, y + 3.0 * s, t.z - 0.2 * s); tmp.scale.set(0.9 * s, 0.8 * s, 0.9 * s); tmp.updateMatrix();
    leaves2.setMatrixAt(i, tmp.matrix);
    const c = leafCols[Math.floor(rand() * leafCols.length)];
    leaves1.setColorAt(i, col.set(c));
    leaves2.setColorAt(i, col.set(c).offsetHSL(0, 0, 0.05));
    obstacles.push({ x: t.x, z: t.z, r: 0.35 * s });
    blobs.push({ x: t.x + 0.3, z: t.z + 0.2, s: 3.4 * s });
  });
  scene.add(trunks, leaves1, leaves2);

  // ---- 圓石(兩三顆一組)----
  const rocks = [];
  for (let g = 0; g < 14; g++) {
    const p = place(3.5), n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) rocks.push({ x: p.x + range(-0.9, 0.9), z: p.z + range(-0.9, 0.9), s: range(0.3, 0.75) });
  }
  const stones = instanced(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshLambertMaterial(), rocks.length);
  const stoneCols = [0xc9c3d9, 0xd6d0e3, 0xbdb7d0, 0xe0d8d2];
  rocks.forEach((r, i) => {
    tmp.position.set(r.x, groundH(r.x, r.z) + r.s * 0.3, r.z);
    tmp.rotation.set(0, rand() * 6.28, 0);
    tmp.scale.set(r.s * 1.15, r.s * 0.72, r.s); tmp.updateMatrix();
    stones.setMatrixAt(i, tmp.matrix);
    stones.setColorAt(i, col.set(stoneCols[Math.floor(rand() * stoneCols.length)]));
    obstacles.push({ x: r.x, z: r.z, r: r.s * 0.85 });
    blobs.push({ x: r.x + 0.1, z: r.z + 0.08, s: r.s * 2.6 });
  });
  scene.add(stones);

  // ---- 靜態軟影子(一次繪製)----
  const shadowMesh = instanced(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, fog: true }),
    blobs.length
  );
  shadowMesh.renderOrder = 1;
  blobs.forEach((b, i) => {
    tmp.position.set(b.x, groundH(b.x, b.z) + 0.05, b.z);
    tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(b.s); tmp.updateMatrix();
    shadowMesh.setMatrixAt(i, tmp.matrix);
  });
  scene.add(shadowMesh);

  return { obstacles };
}
