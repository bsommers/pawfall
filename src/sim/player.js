// Player state machine: ground / air / climb / swing / stun / sink / dying / win.
import { TUNING as T, LAYOUT as L, vineTip } from '../core/defs.js';
import { pitOf, overPit, ladderX, inLadderZone, crocUnder, crocCarrying, crocTop,
  wallClampX } from './physics.js';
import { changeScreen } from './screens.js';

const SINK_DEPTH = T.hitH + 4;
const AIR_ACCEL = 160;       // px/s^2 of horizontal air control
const RUN_FRAME_PX = 5;      // px of travel per run frame
const RUNG_PX = 4;           // px of climb per ladder frame
const SWING_BLEND = 0.12;    // s to ease the hands onto the vine tip

export function makePlayer(x = 16) {
  return { x, y: L.surfaceY, vx: 0, vy: 0, face: 1, layer: 'surface', mode: 'ground', pose: 'idle', frame: 0,
    inv: 0, onLadder: false, onEnt: null, t: 0,
    runDist: 0, climbDist: 0, stunT: 0, sinkT: 0, sinkKind: 'tar', grabCd: 0, landed: true, wallHit: false,
    swingK: 0, offX: 0, offY: 0, deathAt: 0, deathY: L.surfaceY, deathPose: 'dead' };
}

const floorY = (p) => (p.layer === 'tunnel' ? L.tunnelY : L.surfaceY);

function startSink(g, p, pit) {
  p.mode = 'sink'; p.pose = 'sink'; p.frame = 0; p.sinkT = 0; p.vx = 0; p.vy = 0; p.sinkKind = pit.kind; p.y = L.surfaceY;
  g.sfx(pit.kind === 'tar' ? 'tar_glug' : pit.kind === 'quick' ? 'quicksand' : 'splash', p.x, p.y);
  g.fx(pit.kind === 'tar' ? 'poof' : 'splash', p.x, L.surfaceY);
}

/** Shared airborne integration (air + stun). Sets p.landed; may switch to sink / drop to tunnel. */
function ballistic(g, p, dt, dx) {
  const prevY = p.y;
  if (dx) {
    const target = dx * T.airSpeed, a = AIR_ACCEL * dt;
    p.vx = p.vx < target ? Math.min(target, p.vx + a) : Math.max(target, p.vx - a);
  }
  p.vy += T.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  p.landed = false; p.onEnt = null;
  if (p.layer === 'tunnel') {
    if (p.vy < 0 && p.y - T.hitH < L.tunnelTop) { p.y = L.tunnelTop + T.hitH; p.vy = 0; }
    const w = wallClampX(g.screen, p.x); p.x = w.x;
  }
  if (p.vy >= 0 && p.layer === 'surface') {
    const e = crocUnder(g.ents, p.x, p.y, prevY);
    if (e) { p.y = crocTop(e); p.vy = 0; p.vx *= 0.5; p.landed = true; p.onEnt = e.id; g.sfx('land', p.x, p.y); return; }
  }
  const fy = floorY(p);
  if (p.vy >= 0 && p.y >= fy) {
    if (p.layer === 'surface') {
      const pit = overPit(g.screen, p.x);
      if (pit && !(pit.kind === 'hole' && inLadderZone(g.screen, p.x))) {
        if (pit.kind === 'hole') {        // safe drop into the tunnel
          p.y = L.surfaceY; p.layer = 'tunnel'; p.vx = 0; g.sfx('tunnel_drop', p.x, p.y); g.fx('dust', p.x, p.y);
        } else startSink(g, p, pit);
        return;
      }
    }
    if (p.vy > 140) { g.sfx('land', p.x, fy); g.fx('dust', p.x, fy); }
    p.y = fy; p.vy = 0; p.landed = true;
  }
}

function runPose(p, moving, dt) {
  if (moving) { p.pose = 'run'; p.frame = Math.floor(p.runDist / RUN_FRAME_PX) % 6; }
  else { p.pose = 'idle'; p.frame = (p.t % 3.2) > 3.0 ? 1 : (Math.floor(p.t * 1.5) % 2); }
}

function supportY(g, p) {
  if (p.layer === 'tunnel') return { y: L.tunnelY };
  const e = crocCarrying(g.ents, p.x, p.y);
  if (e) return { y: crocTop(e), ent: e.id };
  const pit = overPit(g.screen, p.x);
  if (pit && !(pit.kind === 'hole' && inLadderZone(g.screen, p.x))) return null;
  return { y: L.surfaceY };
}

function startClimb(g, p) {
  p.mode = 'climb'; p.x = ladderX(g.screen); p.vx = 0; p.vy = 0; p.onLadder = true; p.onEnt = null;
  g.sfx('ladder', p.x, p.y);
}

function stepGround(g, p, input, dt) {
  const dx = input.dx | 0, dy = input.dy | 0, s = g.screen, lx = ladderX(s);
  if (lx != null && Math.abs(p.x - lx) <= L.ladderW / 2) {
    if (p.layer === 'surface' && dy > 0 && s.pit?.kind === 'hole') return startClimb(g, p);
    if (p.layer === 'tunnel' && dy < 0) return startClimb(g, p);
  }
  if (input.jumpPressed) {
    p.vy = -T.jumpV; p.vx = dx * T.airSpeed; if (dx) p.face = dx;
    p.mode = 'air'; p.onEnt = null; p.landed = false;
    g.sfx('jump', p.x, p.y); g.fx('dust', p.x, p.y);
    p.pose = 'jump'; p.frame = 0; return;
  }
  p.vx = dx * T.runSpeed; if (dx) p.face = dx;
  const prevX = p.x;
  p.x += p.vx * dt;
  if (p.layer === 'tunnel') {
    const w = wallClampX(s, p.x);
    if (w.hit) {
      p.x = w.x; if (!p.wallHit) g.sfx('brick_bump', p.x, p.y);
      p.wallHit = true;
    } else p.wallHit = false;
  }
  const before = Math.floor(p.runDist / RUN_FRAME_PX);
  p.runDist += Math.abs(p.x - prevX);
  const sup = supportY(g, p);
  if (!sup) { p.mode = 'air'; p.vy = 0; p.onEnt = null; }
  else { p.y = sup.y; p.onEnt = sup.ent ?? null; }
  const moving = dx !== 0 && Math.abs(p.x - prevX) > 1e-6;
  runPose(p, moving, dt);
  if (moving && p.mode === 'ground') {
    const f = Math.floor(p.runDist / RUN_FRAME_PX);
    if (f !== before && (f % 3 === 1)) g.sfx('step', p.x, p.y);
  }
}

function airPose(p) {
  p.pose = 'jump';
  p.frame = p.vy < -60 ? 0 : p.vy > 60 ? 2 : 1;
}

function stepAir(g, p, input, dt) {
  const dx = input.dx | 0;
  if (dx) p.face = dx;
  ballistic(g, p, dt, dx);
  if (p.mode !== 'air') return;
  if (p.landed) { p.mode = 'ground'; runPose(p, false, dt); return; }
  // vine grab
  const pit = pitOf(g.screen);
  if (p.layer === 'surface' && pit?.vine && p.grabCd <= 0) {
    const tip = vineTip(pit.cx, g.vineT), hx = p.x, hy = p.y - T.hitH;
    if (Math.hypot(tip.x - hx, tip.y - hy) <= T.grabR) {
      p.mode = 'swing'; p.swingK = 1; p.offX = hx - tip.x; p.offY = hy - tip.y;
      p.vx = 0; p.vy = 0; g.sfx('swing_grab', p.x, p.y); g.fx('sparkle', tip.x, tip.y);
      return;
    }
  }
  airPose(p);
}

function stepStun(g, p, dt) {
  p.stunT -= dt;
  ballistic(g, p, dt, 0);
  if (p.mode !== 'stun') return;
  if (p.landed) p.vx = 0;
  p.pose = 'hurt'; p.frame = Math.floor(p.t * 10) % 2;
  if (p.stunT <= 0) { p.mode = p.landed ? 'ground' : 'air'; if (p.landed) runPose(p, false, dt); }
}

function tipVel(t, pit) {
  const V = T.vine, w = V.amp * 2 * Math.PI / V.period * Math.cos(t * 2 * Math.PI / V.period);
  const a = V.amp * Math.sin(t * 2 * Math.PI / V.period);
  return { x: V.len * w * Math.cos(a), y: -V.len * w * Math.sin(a) };
}

function stepSwing(g, p, input, dt) {
  const pit = pitOf(g.screen);
  if (!pit?.vine) { p.mode = 'air'; return; }
  const tip = vineTip(pit.cx, g.vineT), tv = tipVel(g.vineT, pit);
  p.swingK = Math.max(0, p.swingK - dt / SWING_BLEND);
  p.x = tip.x + p.offX * p.swingK;
  p.y = tip.y + T.hitH + p.offY * p.swingK;
  if (Math.abs(tv.x) > 12) p.face = tv.x > 0 ? 1 : -1;
  p.vx = tv.x; p.vy = tv.y;
  p.pose = 'swing'; p.frame = Math.abs(tv.x) > 70 ? 1 : 0;
  if (input.jumpPressed) {
    p.mode = 'air'; p.grabCd = 0.35; p.landed = false;
    g.sfx('swing_release', p.x, p.y);
    return;
  }
  if ((p.x <= pit.x0 || p.x >= pit.x1) && p.y >= L.surfaceY - 2) {
    p.mode = 'ground'; p.y = L.surfaceY; p.vx = 0; p.vy = 0; p.grabCd = 0.35;
    g.sfx('land', p.x, p.y);
  }
}

function stepSink(g, p, dt) {
  p.sinkT += dt;
  const u = Math.min(1, p.sinkT / T.sinkTime);
  p.y = L.surfaceY + SINK_DEPTH * u;
  p.pose = 'sink'; p.frame = Math.min(2, Math.floor(u * 3));
  if (Math.floor(p.sinkT * 5) !== Math.floor((p.sinkT - dt) * 5)) g.fx('bubble', p.x + ((p.sinkT * 37) % 5) - 2, L.surfaceY);
  if (p.sinkT >= T.sinkTime) g.kill(p.sinkKind, null);
}

function stepClimb(g, p, input, dt) {
  const dy = input.dy | 0;
  if (dy) {
    const before = Math.floor(p.climbDist / RUNG_PX);
    p.y += dy * T.climbSpeed * dt; p.climbDist += T.climbSpeed * dt;
    if (Math.floor(p.climbDist / RUNG_PX) !== before) g.sfx('ladder', p.x, p.y);
  }
  p.layer = p.y < L.ceilY ? 'surface' : 'tunnel';
  p.pose = 'climb'; p.frame = Math.floor(p.climbDist / RUNG_PX) % 2;
  if (dy < 0 && p.y <= L.surfaceY) { p.y = L.surfaceY; p.layer = 'surface'; endClimb(g, p, dt); }
  else if (dy > 0 && p.y >= L.tunnelY) { p.y = L.tunnelY; p.layer = 'tunnel'; endClimb(g, p, dt); }
}
function endClimb(g, p, dt) { p.mode = 'ground'; p.onLadder = false; p.vx = 0; p.vy = 0; runPose(p, false, dt); }

/** Edge transitions (surface +-1, tunnel +-3). */
function edges(g, p) {
  if (p.mode !== 'ground' && p.mode !== 'air' && p.mode !== 'stun') return;
  if (p.x < L.edgeL) changeScreen(g, -1);
  else if (p.x > L.edgeR) changeScreen(g, 1);
}

export function updatePlayer(g, input, dt) {
  const p = g.player;
  p.t += dt;
  if (p.inv > 0) p.inv = Math.max(0, p.inv - dt);
  if (p.grabCd > 0) p.grabCd -= dt;
  switch (p.mode) {
    case 'ground': stepGround(g, p, input, dt); break;
    case 'air': stepAir(g, p, input, dt); break;
    case 'stun': stepStun(g, p, dt); break;
    case 'swing': stepSwing(g, p, input, dt); break;
    case 'sink': stepSink(g, p, dt); break;
    case 'climb': stepClimb(g, p, input, dt); break;
    default: break;
  }
  edges(g, p);
}

/** Idle animation only (intro state). */
export function idlePlayer(g, dt) {
  const p = g.player; p.t += dt; p.pose = 'idle'; runPose(p, false, dt);
}

export function updateDying(g, dt) {
  const p = g.player; p.t += dt;
  const u = p.t - p.deathAt;
  if (p.deathPose === 'sink') { p.pose = 'sink'; p.frame = 2; return; }
  p.pose = 'dead'; p.frame = u > 0.5 ? 1 : 0;
  const hop = u < 0.4 ? 14 * Math.sin(Math.PI * u / 0.4) : 0;
  p.y = p.deathY - hop;
}

export function updateWin(g, dt) {
  const p = g.player; p.t += dt; p.pose = 'win'; p.frame = Math.floor(p.t * 6) % 3;
}
