// 輸入:鍵盤(WASD / 方向鍵)、觸控/滑鼠拖曳虛擬搖桿、雙指縮放、滾輪縮放
const STICK_RADIUS = 52;

export function createInput(canvas) {
  const move = { x: 0, y: 0 };
  let zoomDelta = 0;

  const keys = new Set();
  const keyMap = {
    KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd',
    KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  };
  window.addEventListener('keydown', (e) => { const k = keyMap[e.code]; if (k) { keys.add(k); e.preventDefault(); } });
  window.addEventListener('keyup', (e) => { const k = keyMap[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());

  const stickEl = document.getElementById('stick');
  const knobEl = document.getElementById('knob');
  const pointers = new Map();
  let stickId = null, origin = null, stick = { x: 0, y: 0 };
  let pinchDist = 0;

  function endStick() {
    stickId = null; stick = { x: 0, y: 0 };
    stickEl.classList.remove('on');
    knobEl.style.transform = '';
  }
  function pairDist() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      stickId = e.pointerId;
      origin = { x: e.clientX, y: e.clientY };
      stickEl.style.left = e.clientX + 'px';
      stickEl.style.top = e.clientY + 'px';
      stickEl.classList.add('on');
    } else if (pointers.size === 2) {
      endStick();
      pinchDist = pairDist();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size >= 2) {
      const d = pairDist();
      if (pinchDist > 0) zoomDelta += (pinchDist - d) * 0.03; // 兩指張開 = 拉近
      pinchDist = d;
    } else if (e.pointerId === stickId) {
      let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      const k = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
      dx *= k; dy *= k;
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      stick = { x: dx / STICK_RADIUS, y: dy / STICK_RADIUS };
    }
  });

  function up(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (e.pointerId === stickId) endStick();
    if (pointers.size < 2) pinchDist = 0;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomDelta += Math.sign(e.deltaY) * 1.2; }, { passive: false });
  // iOS Safari 的手勢縮放
  for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault());

  return {
    move,
    takeZoom() { const z = zoomDelta; zoomDelta = 0; return z; },
    // 每幀呼叫一次,合成最新的移動方向
    poll() {
      let x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
      let y = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
      if (x === 0 && y === 0) { x = stick.x; y = stick.y; }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      else if (len < 0.12) { x = 0; y = 0; }
      move.x = x; move.y = y;
      return move;
    },
  };
}
