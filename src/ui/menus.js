// Menu widgets drawn into the 320x192 buffer: panels, selectable lists (toggle/slider), name entry, hi-score table, how-to-play.
// Pure drawing + tiny state machines; Node-safe (only needs a 2D-context-like object).
import { W, H, PAL } from '../core/defs.js';
import { drawText, measureText } from './font.js';

export const C = Object.freeze({
  gold: PAL.hudTxt, dim: PAL.hudDim, white: PAL.white, red: PAL.red, green: PAL.green, shadow: PAL.outline,
  panel: 'rgba(10,7,16,0.82)', edge: '#ffd23a', edge2: '#8d7a3a',
});
export const blink = (t, hz = 2) => Math.floor(t * hz * 2) % 2 === 0;

/** Dark panel with a double pixel border. */
export function panel(ctx, x, y, w, h, o = {}) {
  ctx.fillStyle = o.fill ?? C.panel; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = o.edge ?? C.edge2; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = o.edge2 ?? C.edge; ctx.fillRect(x + 2, y + 2, w - 4, 1); ctx.fillRect(x + 2, y + h - 3, w - 4, 1); ctx.fillRect(x + 2, y + 2, 1, h - 4); ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
}
/** Gold-on-dark big heading with a drop shadow and optional wobble per letter. */
export function heading(ctx, text, cx, y, { scale = 3, color = C.gold, t = 0, wave = 0 } = {}) {
  if (!wave) { drawText(ctx, text, cx, y, { scale, color, shadow: C.shadow, align: 'center' }); return; }
  const adv = 6 * scale, total = measureText(text, scale);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { drawText(ctx, ch, x, y + Math.round(Math.sin(t * 6 + i * 0.7) * wave), { scale, color, shadow: C.shadow }); x += adv; });
}
export function dimmer(ctx, a = 0.55) { ctx.save?.(); ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore?.(); if (!ctx.save) ctx.globalAlpha = 1; }
export function fmtScore(n, pad = 6) { return String(Math.max(0, Math.floor(n))).padStart(pad, '0'); }
export function fmtClock(sec) { const s = Math.max(0, Math.ceil(sec)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

// ------------------------------------------------------------------ selectable menu
/**
 * items: { label: string | () => string, kind?: 'action'|'toggle'|'slider', get?: () => any, set?: (v) => void, run?: () => void, step?: number, id? }
 * nav(act) returns true when the action was consumed; sfx(name) is called for menu_move / menu_select.
 */
export function createMenu(items, { sfx = () => {} } = {}) {
  const m = {
    items, index: 0,
    nav(act) {
      const it = items[m.index];
      if (act === 'up') { m.index = (m.index + items.length - 1) % items.length; sfx('menu_move'); return true; }
      if (act === 'down') { m.index = (m.index + 1) % items.length; sfx('menu_move'); return true; }
      if (act === 'left' || act === 'right') {
        const d = act === 'left' ? -1 : 1;
        if (it.kind === 'toggle') { it.set(!it.get()); sfx('menu_move'); return true; }
        if (it.kind === 'slider') { const st = it.step ?? 0.1; it.set(Math.min(1, Math.max(0, Math.round((it.get() + d * st) * 100) / 100))); sfx('menu_move'); return true; }
        return false;
      }
      if (act === 'confirm') {
        if (it.kind === 'toggle') it.set(!it.get());
        else if (it.kind === 'slider') it.set(it.get() >= 0.99 ? 0 : Math.min(1, Math.round((it.get() + (it.step ?? 0.1)) * 100) / 100));
        else if (it.run) it.run();
        sfx('menu_select');
        return true;
      }
      return false;
    },
    /** Draw centred list; `w` is the row width used for the value column. */
    draw(ctx, cx, y, t, { scale = 1, gap = 13, w = 150 } = {}) {
      items.forEach((it, i) => {
        const sel = i === m.index, yy = y + i * gap, label = typeof it.label === 'function' ? it.label() : it.label;
        const x0 = cx - w / 2;
        if (sel) {
          ctx.fillStyle = 'rgba(255,210,58,0.18)'; ctx.fillRect(x0 - 6, yy - 3, w + 12, 7 * scale + 5);
          drawText(ctx, '>', x0 - 4 + Math.round(Math.sin(t * 10) * 1), yy, { scale, color: C.gold, shadow: C.shadow });
        }
        const col = sel ? C.white : C.dim;
        if (it.kind === 'toggle' || it.kind === 'slider') {
          drawText(ctx, label, x0 + 8, yy, { scale, color: col, shadow: C.shadow });
          if (it.kind === 'toggle') drawText(ctx, it.get() ? 'ON' : 'OFF', x0 + w, yy, { scale, color: it.get() ? C.green : C.red, shadow: C.shadow, align: 'right' });
          else {
            const bw = 50, bx = x0 + w - bw, v = it.get();
            ctx.fillStyle = C.shadow; ctx.fillRect(bx - 1, yy, bw + 2, 7); ctx.fillStyle = '#3a2f48'; ctx.fillRect(bx, yy + 1, bw, 5);
            ctx.fillStyle = sel ? C.gold : C.edge2; ctx.fillRect(bx, yy + 1, Math.round(bw * v), 5);
          }
        } else drawText(ctx, label, cx + 4, yy, { scale, color: col, shadow: C.shadow, align: 'center' });
      });
    },
  };
  return m;
}

// ------------------------------------------------------------------ 3-letter name entry
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function createNameEntry(initial = 'AAA') {
  const letters = String(initial).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'A').split('');
  const e = {
    letters, pos: 0, done: false,
    get name() { return letters.join(''); },
    /** Returns 'move' | 'done' | null. */
    nav(act, key) {
      if (e.done) return null;
      const cur = ALPHABET.indexOf(letters[e.pos]);
      if (act === 'up') { letters[e.pos] = ALPHABET[(cur + 1) % ALPHABET.length]; return 'move'; }
      if (act === 'down') { letters[e.pos] = ALPHABET[(cur + ALPHABET.length - 1) % ALPHABET.length]; return 'move'; }
      if (act === 'left') { e.pos = Math.max(0, e.pos - 1); return 'move'; }
      if (act === 'right') { e.pos = Math.min(2, e.pos + 1); return 'move'; }
      if (act === 'backspace') { e.pos = Math.max(0, e.pos - 1); return 'move'; }
      if (act === 'char' && key && /^[A-Z0-9]$/.test(key)) { letters[e.pos] = key; if (e.pos < 2) { e.pos++; return 'move'; } return 'move'; }
      if (act === 'confirm') { if (e.pos < 2) { e.pos++; return 'move'; } e.done = true; return 'done'; }
      return null;
    },
    /** Draw the three letters with the active one blinking + arrows. */
    draw(ctx, x, y, t, scale = 1) {
      letters.forEach((ch, i) => {
        const xx = x + i * 6 * scale * 2, act = i === e.pos && !e.done;
        drawText(ctx, ch, xx, y, { scale, color: act ? (blink(t, 4) ? C.white : C.gold) : C.gold, shadow: C.shadow });
        if (act) { ctx.fillStyle = C.gold; ctx.fillRect(xx, y + 8 * scale, 5 * scale, scale); }
      });
    },
  };
  return e;
}

// ------------------------------------------------------------------ hi-score table
/** rows: [{name, score}], `edit` = { rank, entry } draws the name-entry widget on that row, `hl` = rank to highlight. */
export function drawHiTable(ctx, list, x, y, t, { rowH = 10, hl = -1, edit = null, w = 156 } = {}) {
  list.forEach((e, i) => {
    const yy = y + i * rowH, isHl = i === hl, isEdit = edit && edit.rank === i;
    if (isHl || isEdit) { ctx.fillStyle = blink(t, 3) ? 'rgba(255,210,58,0.28)' : 'rgba(255,210,58,0.12)'; ctx.fillRect(x - 4, yy - 2, w + 8, rowH - 1); }
    const col = i === 0 ? C.gold : (isHl || isEdit) ? C.white : i < 3 ? C.white : C.dim;
    drawText(ctx, String(i + 1) + '.', x + 14, yy, { color: col, shadow: C.shadow, align: 'right' });
    if (isEdit) edit.entry.draw(ctx, x + 22, yy, t, 1); else drawText(ctx, e.name, x + 22, yy, { color: col, shadow: C.shadow });
    drawText(ctx, fmtScore(e.score), x + w, yy, { color: col, shadow: C.shadow, align: 'right' });
  });
}

// ------------------------------------------------------------------ how to play
export const HOWTO_LINES = Object.freeze([
  ['RUN', 'LEFT / RIGHT  (A / D)'],
  ['JUMP', 'SPACE, Z or X'],
  ['CLIMB', 'UP / DOWN at a ladder'],
  ['VINES', 'jump to grab, jump to let go'],
  ['LOGS', 'hop them or lose 100 points'],
  ['DEADLY', 'fire, snakes, crocs, tar, quicksand'],
  ['TUNNELS', '1 screen below = 3 above'],
  ['GOAL', '32 treasures, 20:00, 3 lives'],
]);
export function drawHowTo(ctx, art, t) {
  panel(ctx, 14, 22, W - 28, H - 30);
  heading(ctx, 'HOW TO PLAY', W / 2, 28, { scale: 2, t, wave: 1 });
  HOWTO_LINES.forEach(([k, v], i) => {
    const y = 48 + i * 13;
    drawText(ctx, k, 28, y, { color: C.gold, shadow: C.shadow });
    drawText(ctx, v, 84, y, { color: C.white, shadow: C.shadow });
  });
  drawText(ctx, 'P PAUSE   M MUTE   C CRT   F FULLSCREEN', W / 2, 158, { color: C.dim, shadow: C.shadow, align: 'center' });
  if (blink(t, 1.5)) drawText(ctx, 'PRESS SPACE', W / 2, 174, { color: C.gold, shadow: C.shadow, align: 'center' });
  try {
    art?.has?.('colby_idle') && ctx.drawImage(art.get('colby_idle', Math.floor(t * 2)), 280, 150);
    art?.has?.('pete_head') && ctx.drawImage(art.get('pete_head', Math.floor(t * 2)), 24, 156);
  } catch { /* art optional */ }
}
