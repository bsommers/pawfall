// HUD (Pitfall style): black strip on top with score, lives, treasure counter, MM:SS clock; plus Pete taunt banner and big
// center banners (intro). Subscribes to the bus at construction; drawing is a pure function of (game, remembered event times).
import { W, LAYOUT, PAL, TIME_LIMIT, TREASURE_COUNT, START_LIVES } from '../core/defs.js';
import { drawText, measureText } from './font.js';
import { panel, fmtClock, C } from './menus.js';

const LOW_TIME = 60;

export function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function createHud({ bus = null, art = null } = {}) {
  let now = 0;                                 // last seen game.t
  const st = { taunt: null, banner: null, scoreFx: null, treasureFx: -9, lifeFx: -9, lastScore: null };
  const offs = [];
  const sub = (type, fn) => { if (bus) offs.push(bus.on(type, fn)); };
  sub('taunt', (e) => { if (e?.text) st.taunt = { text: String(e.text), t0: null, dur: e.dur ?? 2.5 }; });
  sub('banner', (e) => { if (e?.text) st.banner = { text: String(e.text), sub: e.sub ? String(e.sub) : '', t0: null, dur: e.dur ?? 1.6 }; });
  sub('score', (e) => { if (e && e.delta) st.scoreFx = { delta: e.delta, t0: null }; });
  sub('treasure', () => { st.treasureFx = null; });
  sub('life', () => { st.lifeFx = null; });

  const img = (name, f = 0) => { try { return art && art.has?.(name) !== false ? art.get(name, f) : null; } catch { return null; } };

  function drawStrip(ctx, g) {
    const t = g.t ?? 0, h = LAYOUT.hudH;
    ctx.fillStyle = PAL.hudBg; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = '#3a2f18'; ctx.fillRect(0, h - 1, W, 1);                       // thin gold-dim rule under the strip
    // score
    let sc = C.gold;
    const fx = st.scoreFx;
    if (fx && t - fx.t0 < 0.6) sc = fx.delta > 0 ? C.green : C.red;
    const pop = fx && t - fx.t0 < 0.15 ? 1 : 0;
    drawText(ctx, String(Math.max(0, Math.floor(g.score ?? 0))).padStart(5, '0'), 4, 2 - pop, { scale: 2, color: sc, shadow: '#3a2f18' });
    // lives
    const lives = g.lives ?? START_LIVES, lifeIcon = img('colby_life');
    const flash = t - st.lifeFx < 1 && Math.floor((t - st.lifeFx) * 8) % 2 === 0;
    const show = Math.min(lives, 5);
    for (let i = 0; i < show; i++) {
      const x = 80 + i * 10;
      if (lifeIcon) ctx.drawImage(lifeIcon, x, 5); else { ctx.fillStyle = PAL.fur; ctx.fillRect(x, 5, 8, 8); }
    }
    if (lives > 5) drawText(ctx, '+' + (lives - 5), 80 + 5 * 10 + 1, 6, { color: C.gold, shadow: '#3a2f18' });
    if (flash) { ctx.fillStyle = 'rgba(255,74,58,0.55)'; ctx.fillRect(78, 3, 5 * 10 + 4, 12); }
    if (lives <= 0) drawText(ctx, 'NO LIVES', 80, 6, { color: C.red, shadow: '#3a2f18' });
    // treasure counter
    const n = g.treasureCount ?? 0, tAge = t - st.treasureFx, bounce = tAge < 0.5 ? Math.round(Math.sin(tAge * 20) * 2) : 0;
    const ic = img('tr_tuna', Math.floor(t * 3));
    if (ic) ctx.drawImage(ic, 0, 0, ic.width ?? 12, ic.height ?? 12, 143, 3 + bounce, 12, 12); else { ctx.fillStyle = PAL.gold; ctx.fillRect(144, 5 + bounce, 8, 8); }
    drawText(ctx, `${n}/${TREASURE_COUNT}`, 159, 2 + bounce, { scale: 2, color: tAge < 0.6 ? C.white : (n >= TREASURE_COUNT ? C.green : C.gold), shadow: '#3a2f18' });
    // clock
    const left = g.timeLeft ?? TIME_LIMIT, low = left < LOW_TIME && g.state !== 'gameover';
    let col = C.gold;
    if (low) col = Math.sin(t * (left < 10 ? 14 : 6)) > 0 ? C.red : C.white;
    const jx = left < 10 && g.state === 'play' ? Math.round(Math.sin(t * 40)) : 0;
    drawText(ctx, fmtClock(left), W - 4 + jx, 2, { scale: 2, color: col, shadow: '#3a2f18', align: 'right' });
  }

  function drawTaunt(ctx, g) {
    const k = st.taunt; if (!k) return;
    const t = (g.t ?? 0) - k.t0;
    if (t < 0 || t > k.dur) { if (t > k.dur) st.taunt = null; return; }
    const lines = wrapText(k.text, 36), h = 6 + Math.max(16, lines.length * 9 + 2);
    const slide = Math.min(1, t / 0.15, (k.dur - t) / 0.15), y = LAYOUT.hudH + 3 - Math.round((1 - slide) * (h + 4));
    const w = Math.min(W - 16, Math.max(...lines.map((l) => measureText(l))) + 38);
    const x = Math.round((W - w) / 2);
    panel(ctx, x, y, w, h, { fill: 'rgba(10,7,16,0.88)', edge: PAL.peteSuitL, edge2: PAL.peteStripe });
    const head = img('pete_head', Math.floor(t * 6) % 2);
    if (head) ctx.drawImage(head, x + 5, y + Math.round((h - 16) / 2));
    lines.forEach((l, i) => drawText(ctx, l, x + 26, y + 5 + i * 9, { color: C.white, shadow: C.shadow }));
  }

  function drawBanner(ctx, g) {
    const k = st.banner; if (!k) return;
    const t = (g.t ?? 0) - k.t0;
    if (t < 0 || t > k.dur) { if (t > k.dur) st.banner = null; return; }
    const a = Math.min(1, t / 0.2, (k.dur - t) / 0.25), y = 66;
    ctx.save?.(); ctx.globalAlpha = Math.max(0, a);
    const w = Math.max(measureText(k.text, 3), measureText(k.sub || '', 1)) + 30;
    ctx.fillStyle = 'rgba(10,7,16,0.78)'; ctx.fillRect(Math.round((W - w) / 2), y - 6, w, k.sub ? 54 : 40);
    ctx.fillStyle = C.edge; ctx.fillRect(Math.round((W - w) / 2), y - 6, w, 1); ctx.fillRect(Math.round((W - w) / 2), y - 6 + (k.sub ? 53 : 39), w, 1);
    const sl = Math.round((1 - Math.min(1, t / 0.25)) * 40);
    drawText(ctx, k.text, W / 2 - sl, y + 2, { scale: 3, color: C.gold, shadow: C.shadow, align: 'center' });
    if (k.sub) drawText(ctx, k.sub, W / 2 + sl, y + 32, { color: C.white, shadow: C.shadow, align: 'center' });
    ctx.restore?.(); if (!ctx.save) ctx.globalAlpha = 1;
  }

  return {
    /** `overlays:false` draws the strip only (end screens own the middle of the buffer). */
    draw(ctx, g, { overlays = true } = {}) {
      if (!g) return;
      now = g.t ?? now;
      if (st.taunt && st.taunt.t0 == null) st.taunt.t0 = now;       // events stamp their start on the next draw (game clock restarts per game)
      if (st.banner && st.banner.t0 == null) st.banner.t0 = now;
      if (st.scoreFx && st.scoreFx.t0 == null) st.scoreFx.t0 = now;
      if (st.treasureFx == null) st.treasureFx = now;
      if (st.lifeFx == null) st.lifeFx = now;
      if (st.treasureFx > now + 0.5) st.treasureFx = -9;
      if (st.lifeFx > now + 0.5) st.lifeFx = -9;
      drawStrip(ctx, g); if (overlays) { drawTaunt(ctx, g); drawBanner(ctx, g); }
    },
    /** Test hook. */
    state: st,
    dispose() { for (const o of offs) o(); offs.length = 0; },
  };
}
