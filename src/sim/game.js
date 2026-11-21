// PawFall simulation core (ARCHITECTURE section 4). Pure, deterministic, Node-safe.
import { DT, TIME_LIMIT, START_SCORE, START_LIVES, START_SCREEN, TREASURE_COUNT, TREASURES, TUNING as T, LAYOUT as L } from '../core/defs.js';
import { createBus } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { updatePlayer, idlePlayer, updateDying, updateWin, makePlayer } from './player.js';
import { loadScreen } from './screens.js';
import { hitsEntity } from './physics.js';

// hazards.js is owned by sim-hazards and may be absent / half-written: fall back to a tiny stub.
let ext = null;
try { ext = await import('./hazards.js'); } catch { ext = null; }

const DIMS = { log: [14, 8], stilllog: [16, 8], cheese: [12, 12], fire: [8, 12], snake: [8, 10], croc: [22, 10], scorpion: [12, 8] };
const stubHazards = {
  HAZARDS: {
    log: { init(e) { e.lethal = 'points'; e.vx = -46; }, update(e, dt) { e.x += e.vx * dt; if (e.x < -10) e.x = 330; } },
    stilllog: { init(e) { e.lethal = 'points'; }, update() {} },
    cheese: { init(e) { e.lethal = 'points'; e.vx = -70; }, update(e, dt) { e.x += e.vx * dt; if (e.x < -10) e.x = 330; } },
    fire: { init(e) { e.lethal = 'life'; }, update(e) { e.frame = Math.floor(e.t * 8) % 3; } },
    snake: { init(e) { e.lethal = 'life'; }, update(e) { e.frame = Math.floor(e.t * 3) % 3; } },
    croc: { init(e) { e.solidTop = true; e.lethal = null; },
      update(e) { const open = ((e.t / T.crocPeriod + (e.st.ph ?? 0)) % 1) < T.crocOpenFrac; e.frame = open ? 1 : 0; e.solidTop = !open; e.lethal = open ? 'life' : null; } },
    scorpion: { init(e) { e.lethal = 'life'; e.vx = 20 * (e.dir || 1); }, update(e, dt) { e.x += e.vx * dt; } },
  },
  spawnScreenHazards(g, s) {
    for (const h of s.hazards ?? []) {
      const n = h.kind === 'logs2' ? 2 : h.kind === 'logs3' ? 3 : 1, kind = n > 1 ? 'log' : h.kind;
      for (let i = 0; i < n; i++) g.spawn(kind, { x: (h.x ?? 300) + i * (n === 2 ? 90 : 70), dir: h.dir ?? -1 });
    }
    if (s.pit?.kind === 'croc') {
      const x0 = s.pit.x0 ?? L.pitX0, w = s.pit.w ?? L.pitW;
      for (let i = 0; i < 3; i++) g.spawn('croc', { x: x0 + w * (i + 0.5) / 3, y: L.surfaceY, st: { ph: i / 3 } });
    }
    for (const sc of s.under?.scorp ?? []) g.spawn('scorpion', { x: sc.x, dir: sc.dir ?? 1, layer: 'tunnel', y: L.tunnelY });
  },
};

for (const h of Object.values(stubHazards.HAZARDS)) { const u = h.update; h.update = (e, dt, g) => { e.t += dt; u(e, dt, g); }; }   // stub owns e.t like the real hazards
const MUSIC_DUSK = TIME_LIMIT * 0.3;
const INTRO_TIME = 1.6;

export function createGame({ seed = 1, bus = createBus(), screenAt, startScreen = START_SCREEN, hazards } = {}) {
  const hz = hazards ?? ((ext?.HAZARDS && ext?.spawnScreenHazards) ? ext : stubHazards);
  let nextId = 1, introT = 0, introSent = false, lastSec = Math.ceil(TIME_LIMIT), deathT = 0, endReason = null, lastMusic;

  const g = {
    t: 0, state: 'intro', timeLeft: TIME_LIMIT, score: START_SCORE, lives: START_LIVES,
    screenIdx: 0, screen: null, player: makePlayer(), ents: [], collected: new Set(), treasureCount: 0,
    visited: new Set(), vineT: 0, rng: createRng(seed), bus, screenAt, hz, HAZARDS: hz.HAZARDS,
    stats: { screens: 0, logHits: 0, deaths: 0 },
    get layer() { return this.player.layer; },

    sfx(name, x, y) { bus.emit('sfx', { name, x, y }); },
    fx(type, x, y, opts) { bus.emit('fx', { type, x, y, opts }); },
    popup(text, x, y, color) { bus.emit('popup', { text, x, y, color }); },
    addScore(n) {
      const before = g.score; g.score = Math.max(0, g.score + n);
      if (g.score !== before) bus.emit('score', { score: g.score, delta: g.score - before });
    },
    spawn(kind, props = {}) {
      const [w, h] = DIMS[kind] ?? [10, 10];
      const e = { id: nextId++, kind, x: 0, y: L.surfaceY, w, h, vx: 0, dir: -1, t: 0, frame: 0, layer: 'surface',
        solidTop: false, lethal: null, dead: false, st: {}, ...props };
      if (props.st) e.st = { ...props.st };
      g.ents.push(e);
      g.HAZARDS[kind]?.init?.(e, g);
      return e;
    },
    hurtPoints(n, src) {
      const p = g.player;
      if (g.state !== 'play' || p.inv > 0 || !['ground', 'air', 'climb'].includes(p.mode)) return;
      g.addScore(-n); g.stats.logHits++;
      const dir = src ? (p.x >= src.x ? 1 : -1) : -p.face;
      p.mode = 'stun'; p.stunT = T.logStun; p.vx = dir * 90; p.vy = -110; p.onLadder = false; p.onEnt = null;
      p.inv = T.logStun + 0.8; p.landed = false; p.pose = 'hurt'; p.frame = 0;
      g.sfx('log_hit', p.x, p.y); g.fx('stars', p.x, p.y - T.hitH - 4);
      bus.emit('shake', { mag: 2, dur: 0.15 }); g.popup(`-${n}`, p.x, p.y - 26, '#ff4a3a');
    },
    kill(reason, src) {
      const p = g.player;
      if (g.state !== 'play' || ['dying', 'dead', 'win'].includes(p.mode)) return;
      g.lives = Math.max(0, g.lives - 1); g.stats.deaths++;
      p.deathPose = p.mode === 'sink' ? 'sink' : 'dead';
      p.mode = 'dying'; p.vx = 0; p.vy = 0; p.onLadder = false; p.onEnt = null;
      p.deathAt = p.t; p.deathY = p.y; deathT = T.deathTime; p.pose = p.deathPose; p.frame = p.deathPose === 'sink' ? 2 : 0; endReason = reason;
      g.sfx('die', p.x, p.y);
      if (reason === 'fire') g.sfx('fire_crackle', p.x, p.y);
      else if (reason === 'snake') g.sfx('snake_hiss', p.x, p.y);
      else if (reason === 'scorpion') g.sfx('scorpion', p.x, p.y);
      else if (reason === 'croc') g.sfx('croc_snap', p.x, p.y);
      g.fx('stars', p.x, p.y - T.hitH);
      bus.emit('shake', { mag: 4, dur: 0.3 });
      bus.emit('life', { lives: g.lives, reason });
      setState('dying');
    },
    snapshot() {
      const p = g.player;
      return JSON.stringify({ t: +g.t.toFixed(6), s: g.state, tl: +g.timeLeft.toFixed(6), sc: g.score, l: g.lives, i: g.screenIdx,
        p: [p.x, p.y, p.vx, p.vy, p.mode, p.layer, p.pose, p.frame, p.inv], c: [...g.collected], e: g.ents.map((e) => [e.id, e.kind, e.x, e.y, e.frame]) });
    },
    update(dt, input = {}) { step(dt, input); },
  };

  function setState(s) { g.state = s; bus.emit('state', { state: s }); }
  function music(name) { if (name !== lastMusic) { lastMusic = name; bus.emit('music', { name }); } }
  function chooseMusic() {
    if (g.state === 'gameover') return music('gameover');
    if (g.state === 'victory') return music('victory');
    music(g.player.layer === 'tunnel' ? 'underground' : g.timeLeft < MUSIC_DUSK ? 'dusk' : 'jungle');
  }

  function respawn() {
    const p = g.player;
    loadScreen(g, g.screenIdx);
    Object.assign(p, makePlayer(L.edgeL + 12), { t: p.t, inv: T.respawnInvuln });
    g.sfx('respawn', p.x, p.y); g.fx('poof', p.x, p.y - 10);
    setState('play');
  }
  function endGame(reason) {
    setState('gameover');
    bus.emit('gameover', { score: g.score, treasures: g.treasureCount, screens: g.visited.size, reason });
    g.sfx('gameover');
  }
  function win() {
    const bonus = Math.floor(g.timeLeft) * T.timeBonusPerSec;
    g.addScore(bonus);
    const p = g.player;
    p.mode = 'win'; p.vx = 0; p.vy = 0; p.onLadder = false; p.pose = 'win';
    setState('victory');
    bus.emit('victory', { score: g.score, timeBonus: bonus });
    g.sfx('victory'); g.fx('confetti', p.x, p.y - 30);
  }

  function contacts() {
    const p = g.player;
    if (g.state !== 'play' || p.inv > 0 || !['ground', 'air', 'climb'].includes(p.mode)) return;
    for (const e of g.ents) {
      if (e.dead || e.layer !== p.layer || !e.lethal || !hitsEntity(p, e)) continue;
      if (g.HAZARDS[e.kind]?.onTouch?.(e, g, p) === true) continue;
      if (e.lethal === 'life') g.kill(e.kind, e);
      else if (e.lethal === 'points') g.hurtPoints(e.penalty ?? T.logHitPenalty, e);
      if (g.state !== 'play' || p.inv > 0) break;
    }
  }

  function treasure() {
    const p = g.player, tr = g.screen?.treasure;
    if (!tr || g.collected.has(tr.id) || p.layer !== 'surface') return;
    if (!['ground', 'air', 'climb', 'swing', 'stun'].includes(p.mode)) return;
    const ty = tr.y ?? L.surfaceY, hw = T.hitW / 2;
    if (!(p.x + hw > tr.x - 6 && p.x - hw < tr.x + 6 && p.y > ty - 12 && p.y - T.hitH < ty)) return;
    const def = TREASURES[tr.type] ?? { value: 2000 };
    g.collected.add(tr.id); g.treasureCount = g.collected.size;
    g.addScore(def.value);
    bus.emit('treasure', { id: tr.id, type: tr.type, value: def.value, x: tr.x, y: ty });
    g.sfx(def.value >= 4000 ? 'treasure_big' : 'treasure', tr.x, ty);
    g.fx('sparkle', tr.x, ty - 6); g.popup(`+${def.value}`, tr.x, ty - 16, '#ffd23a');
    if (g.collected.size >= TREASURE_COUNT) win();
  }

  function updateEnts(dt) {
    for (const e of g.ents.slice()) {
      if (e.dead) continue;
      g.HAZARDS[e.kind]?.update?.(e, dt, g);
    }
    if (g.ents.some((e) => e.dead)) g.ents = g.ents.filter((e) => !e.dead);
  }

  function step(dt, input) {
    dt = Math.min(Math.max(dt ?? DT, 0), 1 / 30);
    g.t += dt; g.vineT += dt;
    if (!introSent) {
      introSent = true;
      setState('intro'); music('jungle');
      bus.emit('banner', { text: 'COLBY vs PETE', sub: 'Find all 32 treasures!', dur: INTRO_TIME });
    }
    switch (g.state) {
      case 'intro':
        introT += dt; idlePlayer(g, dt); updateEnts(dt);
        if (introT >= INTRO_TIME) setState('play');
        break;
      case 'play': {
        g.timeLeft = Math.max(0, g.timeLeft - dt);
        const sec = Math.ceil(g.timeLeft);
        if (sec !== lastSec) { lastSec = sec; bus.emit('timer', { left: sec }); if (sec <= 10 && sec > 0) g.sfx('tick_low'); }
        updatePlayer(g, input, dt);
        updateEnts(dt);
        hz.updatePete?.(g, dt, g.screen);
        contacts();
        if (g.state === 'play') treasure();
        if (g.state === 'play' && g.timeLeft <= 0) {
          g.lives = 0; bus.emit('life', { lives: 0, reason: 'time' }); g.player.mode = 'dying';
          g.player.deathPose = 'dead'; g.player.deathAt = g.player.t; g.player.deathY = g.player.y;
          endGame('time');
        }
        break;
      }
      case 'dying':
        updateDying(g, dt); updateEnts(dt);
        deathT -= dt;
        if (deathT <= 0) { if (g.lives <= 0) endGame(endReason); else respawn(); }
        break;
      case 'gameover': updateDying(g, dt); updateEnts(dt); break;
      case 'victory': updateWin(g, dt); updateEnts(dt); break;
      default: break;
    }
    chooseMusic();
  }

  loadScreen(g, startScreen);
  g.player = makePlayer(16);
  return g;
}
