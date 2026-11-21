// Hazard behaviours (ARCHITECTURE §5). Pure, Node-safe, deterministic: no Math.random.
// sim-core calls init(e, g) once per entity and update(e, dt, g) every fixed tick.
// NOTE: src/core/defs.js currently fails to parse (line 125: a `/*feet*/` inside a `/** */`
// block comment closes it early). Until that is fixed upstream, mirror the values we need here.
// Keep these in sync with defs.js LAYOUT / TUNING / W.
const W = 320;
const LAYOUT = Object.freeze({
  surfaceY: 104, tunnelY: 168, wallL: 8, wallR: 296, wallW: 16, edgeL: 4, edgeR: 316,
});
const TUNING = Object.freeze({ crocPeriod: 2.8, crocOpenFrac: 0.45 });

export const TAUNTS = Object.freeze([
  'NICE TRY, FUR-BALL!',
  'THE PICKLES ARE MINE!',
  "YOU CAN'T CATCH ME, KITTY!",
  'MEOW? MORE LIKE MEH-OW!',
  'MY SUIT IS TOO SHARP FOR YOU',
  'CHEESE IS THE ONLY LAW HERE!',
  'THAT HAT IS SO LAST SEASON!',
  "PURR ALL YOU WANT, I'M RICH!",
  'HAND OVER THE TUNA, TABBY!',
  'SMILE, YOU ARE ON CAMERA!',
  'LOST IN MY JUNGLE, KITTY?',
  "NINE LIVES? I'LL TAKE THEM!",
]);

const LOG_SPEED = 46;
const CHEESE_SPEED = 70;
const CHEESE_HOP_PERIOD = 1.2;
const CHEESE_HOP_LEN = 0.35;
const CHEESE_HOP_H = 5;
const SCORP_SPEED = 20;
const PETE_TAUNT_EVERY = 4;

// Deterministic per-screen speed variation: +-8 px/s around the default.
function logSpeed(e, g) {
  const idx = e.screenIdx ?? 0;
  return LOG_SPEED + ((((idx % 5) + 5) % 5) - 2) * 4;
}

function advanceDist(e, dist, framePx, frames) {
  e.st.dist = (e.st.dist ?? 0) + Math.abs(dist);
  e.frame = Math.floor(e.st.dist / framePx) % frames;
}

export const HAZARDS = {
  log: {
    init(e, g) {
      e.st = e.st ?? {};
      e.w = 14; e.h = 8;
      e.lethal = 'points';
      e.solidTop = false;
      e.vx = (e.dir ?? -1) * (e.speed ?? logSpeed(e, g));
      e.frame = 0;
    },
    update(e, dt, g) {
      e.t += dt;
      const dx = e.vx * dt;
      e.x += dx;
      // rolls right -> left, wraps back to the right edge
      if (e.x + e.w / 2 < 0) e.x += W + e.w;
      if (e.x - e.w / 2 > W) e.x -= W + e.w;
      advanceDist(e, dx, 6, 4);
    },
  },

  stilllog: {
    init(e) {
      e.st = e.st ?? {};
      e.w = 16; e.h = 8; e.vx = 0;
      e.lethal = 'points';
      e.solidTop = false;
      e.frame = 0;
    },
    update(e, dt) { e.t += dt; },
  },

  cheese: {
    init(e, g) {
      e.st = e.st ?? {};
      e.w = 12; e.h = 12;
      e.lethal = 'points';
      e.solidTop = false;
      e.vx = (e.dir ?? -1) * (e.speed ?? CHEESE_SPEED);
      e.st.baseY = e.y;
      e.frame = 0;
    },
    update(e, dt, g) {
      e.t += dt;
      const dx = e.vx * dt;
      e.x += dx;
      if (e.x + e.w / 2 < 0) e.x += W + e.w;
      if (e.x - e.w / 2 > W) e.x -= W + e.w;
      // hop every CHEESE_HOP_PERIOD seconds
      const phase = e.t % CHEESE_HOP_PERIOD;
      const hop = phase < CHEESE_HOP_LEN ? Math.sin((Math.PI * phase) / CHEESE_HOP_LEN) : 0;
      e.y = e.st.baseY - CHEESE_HOP_H * hop;
      advanceDist(e, dx, 4, 4);
    },
  },

  fire: {
    init(e) {
      e.st = e.st ?? {};
      e.w = 8; e.h = 12; e.vx = 0;
      e.lethal = 'life';
      e.solidTop = false;
      e.st.phase = e.st.phase ?? 0;
      e.frame = 0;
    },
    update(e, dt) {
      e.t += dt;
      // flicker: 3 frames at ~8 fps, cycled with a fixed per-entity offset
      e.frame = (Math.floor((e.t + e.st.phase) * 8) % 3 + 3) % 3;
    },
  },

  snake: {
    init(e) {
      e.st = e.st ?? {};
      e.w = 8; e.h = 10; e.vx = 0;   // contact box narrower than the 16px sprite
      e.lethal = 'life';
      e.solidTop = false;
      e.st.x0 = e.x;
      e.frame = 0;
    },
    update(e, dt) {
      e.t += dt;
      // coiled and swaying in place: frames 0,1,2 with a small sway
      e.x = e.st.x0 + Math.sin(e.t * 2) * 1;
      e.frame = Math.floor(e.t * 6) % 3;
    },
  },

  croc: {
    init(e) {
      e.st = e.st ?? {};
      e.w = 22; e.h = 10; e.vx = 0;
      e.st.phase = e.st.phase ?? 0;
      // top surface sits at surfaceY - 2 (water line)
      e.y = LAYOUT.surfaceY + 8;
      e.st.period = e.st.period ?? TUNING.crocPeriod;
      e.st.openFrac = e.st.openFrac ?? TUNING.crocOpenFrac;
      applyCroc(e);
    },
    update(e, dt) {
      e.t += dt;
      applyCroc(e);
    },
  },

  scorpion: {
    init(e, g, screen) {
      e.st = e.st ?? {};
      e.w = 12; e.h = 8; e.layer = 'tunnel';
      e.y = LAYOUT.tunnelY;
      e.lethal = 'life';
      e.solidTop = false;
      const wall = e.st.wall ?? null;
      e.st.minX = wall === 'L' ? LAYOUT.wallL + LAYOUT.wallW + e.w / 2 : LAYOUT.edgeL;
      e.st.maxX = wall === 'R' ? LAYOUT.wallR - e.w / 2 : LAYOUT.edgeR;
      e.x = Math.min(e.st.maxX, Math.max(e.st.minX, e.x));
      e.dir = e.dir === 1 ? 1 : -1;
      e.vx = e.dir * SCORP_SPEED;
      e.frame = 0;
    },
    update(e, dt) {
      e.t += dt;
      const dx = e.vx * dt;
      e.x += dx;
      if (e.x <= e.st.minX) { e.x = e.st.minX; e.dir = 1; }
      if (e.x >= e.st.maxX) { e.x = e.st.maxX; e.dir = -1; }
      e.vx = e.dir * SCORP_SPEED;
      advanceDist(e, dx, 4, 2);
    },
  },
};

// Croc mouth cycle: closed (frame 0, walkable solid head) then open (frame 1, deadly).
function applyCroc(e) {
  const cyc = (((e.t + e.st.phase) % e.st.period) + e.st.period) % e.st.period;
  const openStart = e.st.period * (1 - e.st.openFrac);
  const open = cyc >= openStart;
  e.frame = open ? 1 : 0;
  e.solidTop = !open;
  e.lethal = open ? 'life' : null;
}

/** Pete ambush: every PETE_TAUNT_EVERY seconds on a Pete screen, bark a taunt and toss a cheese wheel. */
export function updatePete(g, dt, screen) {
  if (!screen?.pete) return;
  g.peteSt = g.peteSt ?? {};
  const st = (g.peteSt[screen.idx] = g.peteSt[screen.idx] ?? { timer: PETE_TAUNT_EVERY });
  st.timer -= dt;
  if (st.timer > 0) return;
  st.timer += PETE_TAUNT_EVERY;
  const text = g.rng.pick(TAUNTS);
  g.bus?.emit('taunt', { text, dur: 2.5 });
  g.sfx?.('pete_laugh');
  const throwX = W - 4;
  g.spawn('cheese', { x: throwX, y: LAYOUT.surfaceY, dir: -1, speed: CHEESE_SPEED, layer: 'surface', screenIdx: screen.idx });
}

/** Turn a ScreenDef's hazard data into live entities via g.spawn. Called on screen entry. */
export function spawnScreenHazards(g, screen) {
  const surfY = LAYOUT.surfaceY;
  const base = (kind, x, extra = {}) =>
    g.spawn(kind, { x, y: surfY, layer: 'surface', screenIdx: screen.idx, ...extra });

  for (const h of screen.hazards ?? []) {
    const extra = { dir: h.dir, speed: h.speed };
    switch (h.kind) {
      case 'log':
        base('log', h.x ?? W - 16, extra);
        break;
      case 'logs2':
        for (let i = 0; i < 2; i++) base('log', (h.x ?? W - 16) + i * 90, extra);
        break;
      case 'logs3':
        for (let i = 0; i < 3; i++) base('log', (h.x ?? W - 16) + i * 70, extra);
        break;
      case 'stilllog':
        base('stilllog', h.x ?? W / 2);
        break;
      case 'cheese':
        base('cheese', h.x ?? W - 4, extra);
        break;
      case 'fire':
        base('fire', h.x ?? W / 2);
        break;
      case 'snake':
        base('snake', h.x ?? W / 2);
        break;
      default:
        break;
    }
  }

  if (screen.pit?.kind === 'croc') {
    const { x0, w } = screen.pit;
    for (let i = 0; i < 3; i++) {
      const x = x0 + (w * (i + 1)) / 4;
      g.spawn('croc', {
        x, y: surfY + 8, layer: 'surface', screenIdx: screen.idx,
        st: { phase: (i * TUNING.crocPeriod) / 3 },
      });
    }
  }

  for (const s of screen.under?.scorp ?? []) {
    g.spawn('scorpion', {
      x: s.x, y: LAYOUT.tunnelY, layer: 'tunnel', dir: s.dir === 1 ? 1 : -1,
      screenIdx: screen.idx, st: { wall: screen.under.wall ?? null },
    });
  }
}
