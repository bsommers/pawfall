// Pure-ish helpers for PawFall collision/support rules. Node-safe, no DOM.
import { LAYOUT as L, TUNING as T } from '../core/defs.js';

export const DEADLY = new Set(['tar', 'quick', 'water', 'croc']);

/** Normalised pit extents of a ScreenDef (or null). */
export function pitOf(screen) {
  const p = screen && screen.pit;
  if (!p) return null;
  const x0 = p.x0 ?? L.pitX0, w = p.w ?? L.pitW;
  return { kind: p.kind, x0, x1: x0 + w, w, cx: x0 + w / 2, vine: !!p.vine, ladder: !!p.ladder };
}
/** Pit whose extents strictly contain centre x, else null. */
export function overPit(screen, x) {
  const q = pitOf(screen);
  return q && x > q.x0 && x < q.x1 ? q : null;
}
export const ladderX = (screen) => screen?.under?.ladderX ?? null;
/** True when x is within the ladder rim (the ladder top is standable). */
export function inLadderZone(screen, x) {
  const lx = ladderX(screen);
  return lx != null && Math.abs(x - lx) <= L.ladderW / 2;
}
/** Standable top of a croc head (feet y) = top of its box (e.y is the body base, ~8px below the water line). */
export const crocTop = (e) => e.topY ?? (e.y - e.h);
/** Standable croc head under (x) for a body falling from prevY to y. */
export function crocUnder(ents, x, y, prevY) {
  for (const e of ents) {
    if (e.dead || !e.solidTop || e.layer !== 'surface') continue;
    const top = crocTop(e);
    if (Math.abs(x - e.x) <= e.w / 2 + 2 && prevY <= top + 1 && y >= top) return e;
  }
  return null;
}
/** Croc head currently carrying a body standing at (x,y). */
export function crocCarrying(ents, x, y) {
  for (const e of ents) {
    if (e.dead || !e.solidTop || e.layer !== 'surface') continue;
    if (Math.abs(x - e.x) <= e.w / 2 + 2 && Math.abs(y - crocTop(e)) <= 3) return e;
  }
  return null;
}
/** Tunnel brick wall span [a,b] or null. */
export function wallSpan(screen) {
  const w = screen?.under?.wall;
  if (w === 'L') return [L.wallL, L.wallL + L.wallW];
  if (w === 'R') return [L.wallR, L.wallR + L.wallW];
  return null;
}
/** Push x out of the brick wall; returns {x, hit}. */
export function wallClampX(screen, x) {
  const s = wallSpan(screen);
  if (!s) return { x, hit: false };
  const half = T.hitW / 2, [a, b] = s;
  if (x + half > a && x - half < b) return { x: x < (a + b) / 2 ? a - half : b + half, hit: true };
  return { x, hit: false };
}
/** Player hitbox vs entity box (feet anchored). */
export function hitsEntity(p, e) {
  const hw = T.hitW / 2;
  return p.x + hw > e.x - e.w / 2 && p.x - hw < e.x + e.w / 2 && p.y > e.y - e.h && p.y - T.hitH < e.y;
}
