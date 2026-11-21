// Particles (owner: render): listens to the bus at construction time; update/draw are pure functions of sim time.
// Types from 'fx' events: splash dust sparkle stars bubble poof confetti tarsplat; plus 'popup' text, 'treasure' glints,
// ambient falling leaves. No global randomness: a tiny local LCG seeded per instance.
import { W, LAYOUT as L, PAL } from '../core/defs.js';
import { drawText } from '../ui/font.js';

export function createParticles(bus, art, opts = {}) {
  const list = [];
  let seed = (opts.seed ?? 12345) >>> 0, textOK = true, leafAcc = 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const MAX = opts.max ?? 400;
  const add = (p) => { if (list.length >= MAX) list.shift(); list.push({ age: 0, vx: 0, vy: 0, g: 0, ...p }); };
  const bits = (n, x, y, cols, o = {}) => {
    for (let i = 0; i < n; i++) {
      const a = (o.a0 ?? -Math.PI) + rnd() * (o.arc ?? Math.PI), v = (o.v ?? 60) * (0.4 + rnd() * 0.8);
      add({ kind: 'bit', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g ?? 220, life: (o.life ?? 0.6) * (0.6 + rnd() * 0.6), col: cols[(rnd() * cols.length) | 0], sz: o.sz ?? 1 });
    }
  };
  const anim = (sprite, x, y, life, o = {}) => add({ kind: 'anim', sprite, x, y, life, vy: o.vy ?? 0, vx: o.vx ?? 0, follow: o.follow });

  const FX = {
    splash(x, y) { anim('fx_splash', x, y, 0.45); bits(10, x, y, [PAL.waterL, PAL.water, PAL.white], { v: 70, life: 0.7, arc: Math.PI * 0.8, a0: -Math.PI * 0.9 }); },
    tarsplat(x, y) { anim('fx_tarsplat', x, y, 0.5); bits(8, x, y, [PAL.tar, PAL.tarL], { v: 55, life: 0.6, arc: Math.PI * 0.8, a0: -Math.PI * 0.9 }); },
    dust(x, y, o) { anim('fx_dust', x, y, 0.32, { vy: -8, vx: -(o?.dir ?? 0) * 10 }); },
    sparkle(x, y) { anim('fx_sparkle', x, y - 6, 0.5); bits(12, x, y - 6, [PAL.gold, PAL.fireL, PAL.white], { v: 80, life: 0.8, arc: Math.PI * 2, a0: 0, g: 40 }); },
    stars(x, y) { anim('fx_stars', x, y - 26, 1.1); },
    bubble(x, y) { add({ kind: 'anim', sprite: 'fx_bubble', x, y, life: 0.9 + rnd() * 0.4, vy: -22, vx: (rnd() - 0.5) * 8 }); },
    poof(x, y) { anim('fx_poof', x, y - 8, 0.45); },
    confetti(x, y) {
      for (let i = 0; i < 28; i++) add({ kind: 'conf', x: x + (rnd() - 0.5) * 60, y: y - rnd() * 20, vx: (rnd() - 0.5) * 50, vy: -20 - rnd() * 60, g: 70, life: 1.8 + rnd(), col: [PAL.red, PAL.gold, PAL.green, PAL.waterL, PAL.nose][i % 5] });
    },
  };
  const offs = [];
  if (bus) {
    offs.push(bus.on('fx', (e) => { if (e) (FX[e.type] || FX.poof)(e.x ?? W / 2, e.y ?? L.surfaceY, e.opts); }));
    offs.push(bus.on('popup', (e) => { if (e) add({ kind: 'text', text: String(e.text), x: e.x ?? W / 2, y: (e.y ?? L.surfaceY) - 14, vy: -16, life: 1.1, col: e.color || PAL.hudTxt }); }));
    offs.push(bus.on('treasure', (e) => { if (e) bits(16, e.x ?? W / 2, (e.y ?? L.surfaceY) - 6, [PAL.gold, PAL.fireL, PAL.white, PAL.gem], { v: 95, life: 1.0, arc: Math.PI * 2, a0: 0, g: 30 }); }));
    offs.push(bus.on('screen', () => { list.length = 0; }));
  }

  return {
    get count() { return list.length; },
    clear() { list.length = 0; },
    dispose() { for (const o of offs) o(); offs.length = 0; },
    spawn(type, x, y, o) { (FX[type] || FX.poof)(x, y, o); },
    update(dt, game) {
      dt = Math.max(0, Math.min(0.1, dt));
      if (dt <= 0) return;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt; if (p.age >= p.life) { list.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'leaf') p.x += Math.sin(p.age * 3 + p.ph) * 14 * dt;
        if (p.kind === 'conf') p.x += Math.sin(p.age * 7 + p.x) * 12 * dt;
      }
      // ambient leaves in leafy moods (a few at a time)
      const mood = game && game.screen && game.screen.mood;
      if (mood && mood !== 'ruins') {
        leafAcc += dt * (mood === 'deep' ? 0.9 : 0.5);
        if (leafAcc >= 1 && list.length < MAX - 20) { leafAcc = 0; add({ kind: 'leaf', x: 20 + rnd() * (W - 40), y: L.canopyBottom, vy: 14 + rnd() * 8, vx: (rnd() - 0.5) * 10, life: 5, ph: rnd() * 6, frame: (rnd() * 4) | 0 }); }
      }
    },
    draw(ctx, t = 0) {
      for (const p of list) {
        const u = p.age / p.life;
        if (p.kind === 'anim') {
          const n = art.frames(p.sprite), img = art.get(p.sprite, Math.min(n - 1, (u * n) | 0)), w = img.width ?? img.w, h = img.height ?? img.h;
          if (p.sprite === 'fx_stars') { ctx.globalAlpha = 1 - u * u; }
          ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h)); ctx.globalAlpha = 1;
        } else if (p.kind === 'bit' || p.kind === 'conf') {
          ctx.globalAlpha = Math.min(1, (1 - u) * 2);
          ctx.fillStyle = p.col; const s = p.sz ?? (p.kind === 'conf' ? 2 : 1); ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s); ctx.globalAlpha = 1;
        } else if (p.kind === 'leaf') {
          ctx.globalAlpha = Math.min(1, (1 - u) * 3); ctx.drawImage(art.get('fx_leaf', (p.frame + Math.floor(p.age * 4)) & 3), Math.round(p.x), Math.round(p.y)); ctx.globalAlpha = 1;
        } else if (p.kind === 'text' && textOK) {
          ctx.globalAlpha = Math.min(1, (1 - u) * 3);
          try { drawText(ctx, p.text, Math.round(p.x), Math.round(p.y), { color: p.col, shadow: PAL.outline, align: 'center' }); } catch { textOK = false; }
          ctx.globalAlpha = 1;
        }
      }
    },
  };
}
