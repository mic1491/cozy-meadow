import * as THREE from 'three';

// 用基本形狀組成的 Q 版小主角(約 2.7 頭身)。面向 +z。
const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
const ball = (r, c, sx = 1, sy = 1, sz = 1, seg = 20) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat(c));
  m.scale.set(sx, sy, sz);
  return m;
};

const SKIN = 0xffdcc0, HAIR = 0x9a6a46, SHIRT = 0xff8fa8, PANTS = 0xfff0cf, LEAF = 0x6fd08c, EYE = 0x3d3050, BLUSH = 0xff9eb5;

export function createHero() {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // 身體
  const body = ball(0.4, SHIRT, 1, 0.95, 0.9);
  body.position.y = 0.62;
  rig.add(body);
  const shorts = ball(0.34, PANTS, 1.05, 0.55, 0.95);
  shorts.position.y = 0.38;
  rig.add(shorts);

  // 腳
  const legs = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.17, 0.3, 0);
    const foot = ball(0.15, 0xffffff, 0.95, 1.1, 1.35);
    foot.position.set(0, -0.15, 0.04);
    g.add(foot);
    rig.add(g);
    return g;
  });

  // 手
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.42, 0.78, 0);
    const hand = ball(0.12, SKIN, 1, 1.25, 1);
    hand.position.set(s * 0.04, -0.14, 0);
    g.add(hand);
    g.rotation.z = s * 0.25;
    rig.add(g);
    return g;
  });

  // 頭
  const head = new THREE.Group();
  head.position.y = 1.4;
  rig.add(head);
  head.add(ball(0.55, SKIN, 1.04, 0.92, 0.97, 28));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.585, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), mat(HAIR));
  hair.scale.set(1.04, 0.95, 1.0);
  hair.rotation.x = -0.42;
  hair.position.y = 0.02;
  head.add(hair);
  // 瀏海小塊
  const bang = ball(0.17, HAIR, 1.3, 0.8, 0.7);
  bang.position.set(0.12, 0.36, 0.42);
  head.add(bang);
  // 頭上的小葉子
  const leaf = ball(0.14, LEAF, 0.55, 0.28, 1.25, 12);
  leaf.position.set(0.04, 0.58, 0.05);
  leaf.rotation.set(-0.5, 0.4, 0.3);
  head.add(leaf);
  for (const s of [-1, 1]) {
    const ear = ball(0.1, SKIN, 0.6, 1, 0.9, 12);
    ear.position.set(s * 0.56, -0.03, 0);
    head.add(ear);
  }
  const eyes = [-1, 1].map((s) => {
    const e = ball(0.065, EYE, 0.9, 1.35, 0.6, 12);
    e.position.set(s * 0.2, -0.06, 0.5);
    head.add(e);
    const shine = ball(0.02, 0xffffff, 1, 1, 1, 6);
    shine.position.set(0.02, 0.03, 0.04);
    e.add(shine);
    const cheek = ball(0.09, BLUSH, 1.3, 0.8, 0.4, 12);
    cheek.position.set(s * 0.34, -0.2, 0.42);
    cheek.rotation.y = s * 0.7;
    head.add(cheek);
    return e;
  });
  const mouth = ball(0.035, 0xd9667f, 1.6, 0.8, 0.5, 8);
  mouth.position.set(0, -0.2, 0.52);
  head.add(mouth);

  // 腳下軟影子(藍紫色)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, fog: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  shadow.renderOrder = 2;
  root.add(shadow);

  let phase = 0, facing = 0, nextBlink = 2.5, blinkT = 0, hop = 0;

  function update(dt, time, vel, strength) {
    const moving = strength > 0.05;
    if (moving) {
      const target = Math.atan2(vel.x, vel.y);
      let d = target - facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      facing += d * (1 - Math.exp(-14 * dt));
      phase += dt * (7 + strength * 5);
    } else {
      phase += dt * 2;
    }
    root.rotation.y = facing;

    const swing = moving ? Math.sin(phase) * 0.75 * Math.min(1, strength * 1.2) : 0;
    legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.9; arms[1].rotation.x = swing * 0.9;

    // 走路輕快彈跳、停下來呼吸
    const bounce = moving ? Math.abs(Math.sin(phase)) * 0.14 * strength : 0;
    hop += (bounce - hop) * (1 - Math.exp(-20 * dt));
    const breathe = moving ? 0 : Math.sin(time * 2.2) * 0.018;
    rig.position.y = hop;
    rig.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
    const squash = moving ? Math.sin(phase * 2) * 0.03 * strength : 0;
    body.scale.y = 0.95 + squash;
    head.rotation.z = moving ? Math.sin(phase) * 0.06 * strength : Math.sin(time * 0.9) * 0.03;
    head.rotation.x = moving ? 0.05 : 0;

    // 眨眼
    if (time > nextBlink && blinkT <= 0) { blinkT = 0.13; nextBlink = time + 2 + Math.random() * 3.5; }
    let sy = 1.35;
    if (blinkT > 0) { blinkT -= dt; sy = 0.15; }
    for (const e of eyes) e.scale.y = sy;

    shadow.scale.setScalar(1 - hop * 1.4);
  }

  return { root, update };
}

let _blob;
export function blobTexture() {
  if (_blob) return _blob;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(110,98,175,0.42)');
  grad.addColorStop(0.55, 'rgba(110,98,175,0.22)');
  grad.addColorStop(1, 'rgba(110,98,175,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  _blob = new THREE.CanvasTexture(c);
  _blob.colorSpace = THREE.SRGBColorSpace;
  return _blob;
}
