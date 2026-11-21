// Screen loading / edge transitions (circular world; tunnel steps TUNNEL_STRIDE screens).
import { LAYOUT as L, WORLD_SCREENS, TUNNEL_STRIDE } from '../core/defs.js';

export const wrapIdx = (i) => ((i % WORLD_SCREENS) + WORLD_SCREENS) % WORLD_SCREENS;

export function emptyScreen(idx) {
  return { idx, trees: [60, 250], mood: 'bright', pit: null, hazards: [], treasure: null,
    under: { wall: null, scorp: [], ladderX: null }, pete: false };
}

/** Make `idx` the current screen; entities respawn from its ScreenDef. */
export function loadScreen(g, idx) {
  idx = wrapIdx(idx);
  g.screenIdx = idx;
  g.screen = g.screenAt?.(idx) ?? emptyScreen(idx);
  g.ents = [];
  g.visited.add(idx);
  g.stats.screens = g.visited.size;
  g.hz.spawnScreenHazards(g, g.screen);
}

/** Player left an edge: dir -1 (left) / +1 (right). */
export function changeScreen(g, dir) {
  const p = g.player, from = g.screenIdx;
  const step = p.layer === 'tunnel' ? TUNNEL_STRIDE : 1;
  loadScreen(g, from + dir * step);
  p.x = dir > 0 ? L.edgeL + 1 : L.edgeR - 1;
  p.wallHit = false;
  g.bus.emit('screen', { idx: g.screenIdx, layer: p.layer, from, dir });
  g.sfx('screen_flip');
}
