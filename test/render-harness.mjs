// Test/dev harness for the renderer (owner: render): a PixBuf-backed 2D-context shim + a fake `game` object.
// Supports exactly the context API the renderer uses (fillRect, drawImage 3/5/9 args, save/restore, translate,
// scale(+-1), clip rect, globalAlpha, 'lighter'). Not a general canvas.
import { PixBuf, ink } from '../src/art/pixbuf.js';

function parseFill(s) {
  if (typeof s !== 'string') return [0, 0, 0, 1];
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  const k = ink(s); return [k.r, k.g, k.b, k.a / 255];
}

export function createShimCanvas(w, h) {
  const c = { width: w, height: h, rgba: new Uint8ClampedArray(w * h * 4) };
  Object.defineProperty(c, 'w', { get() { return this.width; } });
  Object.defineProperty(c, 'h', { get() { return this.height; } });
  c.getContext = () => c._ctx || (c._ctx = makeCtx(c));
  return c;
}

function makeCtx(c) {
  let st = { tx: 0, ty: 0, sx: 1, sy: 1, alpha: 1, comp: 'source-over', fill: [0, 0, 0, 1], clip: null };
  const stack = [];
  const clipRect = (x0, y0, x1, y1) => {
    const k = st.clip; if (!k) return [x0, y0, x1, y1];
    return [Math.max(x0, k[0]), Math.max(y0, k[1]), Math.min(x1, k[2]), Math.min(y1, k[3])];
  };
  function plot(x, y, r, g, b, a) {
    if (a <= 0) return;
    const i = (y * c.width + x) * 4, d = c.rgba;
    if (st.comp === 'lighter') {
      d[i] = Math.min(255, d[i] + r * a); d[i + 1] = Math.min(255, d[i + 1] + g * a); d[i + 2] = Math.min(255, d[i + 2] + b * a); d[i + 3] = Math.max(d[i + 3], 255 * a);
      return;
    }
    const da = d[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = (r * a + d[i] * da * (1 - a)) / oa; d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa; d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa; d[i + 3] = oa * 255;
  }
  // map a destination rect (in user space) to device space honouring translate + sign scale
  function devRect(x, y, w, h) {
    let x0 = st.tx + st.sx * x, x1 = st.tx + st.sx * (x + w);
    let y0 = st.ty + st.sy * y, y1 = st.ty + st.sy * (y + h);
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
  }
  const ctx = {
    canvas: c, imageSmoothingEnabled: false,
    get globalAlpha() { return st.alpha; }, set globalAlpha(v) { st.alpha = v; },
    get globalCompositeOperation() { return st.comp; }, set globalCompositeOperation(v) { st.comp = v; },
    get fillStyle() { return st.fillRaw; }, set fillStyle(v) { st.fillRaw = v; st.fill = parseFill(v); },
    save() { stack.push({ ...st }); }, restore() { st = stack.pop() || st; },
    translate(x, y) { st.tx += st.sx * x; st.ty += st.sy * y; },
    scale(x, y) { st.sx *= x; st.sy *= y; },
    setTransform(a, b, cc, d, e, f) { st.sx = a; st.sy = d; st.tx = e; st.ty = f; },
    beginPath() { st.path = null; }, rect(x, y, w, h) { st.path = devRect(x, y, w, h); }, clip() { if (st.path) st.clip = clipRect(...st.path); },
    clearRect(x, y, w, h) {
      let [x0, y0, x1, y1] = clipRect(...devRect(x, y, w, h)); x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(c.width, x1); y1 = Math.min(c.height, y1);
      for (let yy = y0; yy < y1; yy++) c.rgba.fill(0, (yy * c.width + x0) * 4, (yy * c.width + x1) * 4);
    },
    fillRect(x, y, w, h) {
      let [x0, y0, x1, y1] = clipRect(...devRect(x, y, w, h)); x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(c.width, x1); y1 = Math.min(c.height, y1);
      const [r, g, b, a0] = st.fill, a = a0 * st.alpha;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) plot(xx, yy, r, g, b, a);
    },
    putImageData() { throw new Error('shim: putImageData unsupported (use forcePix art)'); },
    drawImage(src, ...a) {
      let sx = 0, sy = 0, sw = src.w ?? src.width, sh = src.h ?? src.height, dx, dy, dw, dh;
      if (a.length === 2) { [dx, dy] = a; dw = sw; dh = sh; }
      else if (a.length === 4) { [dx, dy, dw, dh] = a; }
      else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
      const rg = src.rgba, srcW = src.w ?? src.width;
      let [x0, y0, x1, y1] = devRect(dx, dy, dw, dh);
      const flipX = st.sx < 0, flipY = st.sy < 0, ddw = x1 - x0, ddh = y1 - y0;
      if (ddw <= 0 || ddh <= 0) return;
      const [cx0, cy0, cx1, cy1] = clipRect(Math.max(0, x0), Math.max(0, y0), Math.min(c.width, x1), Math.min(c.height, y1));
      for (let yy = cy0; yy < cy1; yy++) {
        let v = Math.floor(((yy - y0) + 0.5) * sh / ddh); if (flipY) v = sh - 1 - v;
        for (let xx = cx0; xx < cx1; xx++) {
          let u = Math.floor(((xx - x0) + 0.5) * sw / ddw); if (flipX) u = sw - 1 - u;
          const i = ((sy + v) * srcW + (sx + u)) * 4, al = rg[i + 3] / 255 * st.alpha;
          if (al > 0) plot(xx, yy, rg[i], rg[i + 1], rg[i + 2], al);
        }
      }
    },
  };
  return ctx;
}

/** Deterministic synthetic ScreenDef (used when levels/world.js is absent, and for pit-kind coverage). */
export function fakeScreen(idx, over = {}) {
  const kinds = [null, 'hole', 'tar', 'quick', 'water', 'croc'], kind = over.kind !== undefined ? over.kind : kinds[idx % 6];
  const moods = ['bright', 'deep', 'swamp', 'ruins', 'pete'];
  const pit = kind ? { kind, x0: 136, w: kind === 'croc' ? 64 : 48, vine: kind !== 'hole' && idx % 2 === 0, ladder: kind === 'hole' } : null;
  if (pit && kind === 'croc') pit.x0 = 128;
  return {
    idx, trees: [40 + (idx % 3) * 10, 250 - (idx % 4) * 8, ...(idx % 2 ? [90] : [])], mood: over.mood ?? moods[idx % 5], pit, hazards: [],
    treasure: idx % 4 === 0 ? { id: idx, type: ['tuna', 'sardine', 'gold', 'collar'][(idx >> 2) % 4], x: 60 } : null,
    under: { wall: [null, 'L', 'R'][idx % 3], scorp: [], ladderX: pit && pit.kind === 'hole' ? pit.x0 + pit.w / 2 : null },
    pete: idx % 5 === 4, ...over.extra,
  };
}

/** Minimal game-shaped object (read-only fields the renderer uses). */
export function fakeGame(over = {}) {
  const screenIdx = over.screenIdx ?? 1, screen = over.screen ?? fakeScreen(screenIdx);
  return {
    t: 0, state: 'play', timeLeft: 1200, score: 2000, lives: 3, screenIdx, layer: 'surface', screen,
    player: { x: 100, y: 104, vx: 0, vy: 0, face: 1, layer: 'surface', mode: 'ground', pose: 'idle', frame: 0, inv: 0, onLadder: false, onEnt: null, t: 0 },
    ents: [], collected: new Set(), vineT: 0, ...over,
  };
}
