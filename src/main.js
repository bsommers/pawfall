// PawFall entry point: boots art, audio, renderer and game with graceful fallbacks (the page always comes up, even when a
// sibling module is missing or broken), runs the fixed-timestep loop, and wires input -> screens -> sim.
// Query params: ?autostart=1 ?screen=N ?seed=N ?bot=1 ?time=SECONDS ?nosound=1 ?touch=1 ?manual=1 ?poll
import { W, H, DT, TIME_LIMIT, START_SCREEN } from './core/defs.js';
import { createBus } from './core/events.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { createInput, stepInput } from './core/input.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createTouch } from './ui/touch.js';
import { drawText } from './ui/font.js';

const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const flag = (k) => q.has(k) && q.get(k) !== '0' && q.get(k) !== 'false';
const num = (k, d) => { const v = Number(q.get(k)); return q.has(k) && Number.isFinite(v) ? v : d; };

const missing = [];
async function opt(path, label) {
  try { return await import(path); } catch (e) { missing.push(label + ': ' + (e && e.message ? e.message : e)); if (typeof console !== 'undefined') console.warn('[pawfall] optional module failed:', label, e); return null; }
}

/** Visual-only forwarding bus for the title attract game: sound/state/HUD events are dropped so it never talks over the real UI. */
function filteredBus(main, allow) {
  return { on: (t, f) => main.on(t, f), emit: (t, p) => { if (allow.has(t)) main.emit(t, p); } };
}

async function boot() {
  const canvas = document.getElementById('game');
  const bootEl = document.getElementById('boot');
  const settings = loadSettings();
  const bus = createBus();
  const input = createInput({ target: window });

  const [rArt, rRender, rGame, rWorld, rAudio, rBot] = await Promise.all([
    opt('./art/registry.js', 'art/registry'), opt('./render/renderer.js', 'render/renderer'), opt('./sim/game.js', 'sim/game'),
    opt('./levels/world.js', 'levels/world'), opt('./audio/audio.js', 'audio/audio'), opt('./sim/autopilot.js', 'sim/autopilot'),
  ]);
  if (!rBot) missing.pop();                                    // the autopilot is allowed to be absent (written later by qa-bot)

  // --- art
  let art = null;
  try { art = rArt?.buildAll ? rArt.buildAll() : null; if (art?.ready) await art.ready; } catch (e) { missing.push('art build: ' + e.message); art = null; }

  // --- renderer (real one, or a tiny placeholder that still shows the UI)
  let renderer = null;
  try { if (rRender?.createRenderer && art) renderer = rRender.createRenderer(canvas, { bus, art, settings }); } catch (e) { missing.push('renderer: ' + e.message); }
  if (!renderer) renderer = fallbackRenderer(canvas, settings);
  renderer.setCRT?.(settings.crt !== false);

  // --- audio
  let audio = null;
  if (!flag('nosound') && rAudio?.createAudio) { try { audio = rAudio.createAudio(bus, settings); } catch (e) { missing.push('audio: ' + e.message); } }
  let unlocked = false;
  const unlock = () => { if (unlocked) return; unlocked = true; try { audio?.unlock?.(); } catch { /* ignore */ } if (ui.mode === 'title') bus.emit('music', { name: 'title' }); };
  addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);

  // --- sim
  const canGame = !!(rGame?.createGame && rWorld?.screenAt);
  if (!canGame) missing.push('sim unavailable (need sim/game.js + levels/world.js)');
  let seedCounter = num('seed', 1), game = null, attract = null, attractBot = null, attractAge = 0, playBot = null;
  const makeBot = (g) => {
    const m = rBot; if (!m) return null;
    const f = m.createAutopilot || m.createBot || m.default;
    try {
      const b = typeof f === 'function' ? f(g) : null;
      if (typeof b === 'function') return (gg, dt) => b(gg, dt);
      const fn = b && (b.input || b.think || b.step || b.decide);
      if (fn) return (gg, dt) => fn.call(b, gg, dt);
    } catch (e) { console.warn('[pawfall] autopilot failed', e); }
    return null;
  };
  const newGame = (o = {}) => {
    const g = rGame.createGame({ seed: o.seed ?? seedCounter, bus: o.bus ?? bus, screenAt: rWorld.screenAt, startScreen: o.startScreen ?? START_SCREEN });
    if (o.time != null) g.timeLeft = Math.max(1, Math.min(TIME_LIMIT, o.time));
    return g;
  };
  const ATTRACT_SCREENS = [0, 5, 14, 22, 31, 47, 60, 83];
  const VISUAL = new Set(['fx', 'shake', 'popup', 'screen', 'treasure']);
  function startAttract() {
    if (!canGame) return;
    attractAge = 0;
    try {
      attract = newGame({ seed: 100 + seedCounter++, startScreen: ATTRACT_SCREENS[seedCounter % ATTRACT_SCREENS.length], bus: filteredBus(bus, VISUAL), time: 900 });
      attractBot = makeBot(attract);
    } catch (e) { missing.push('attract: ' + e.message); attract = null; }
  }

  // --- UI
  const hud = createHud({ bus, art });
  const applySetting = (k, v) => {
    settings[k] = v; saveSettings(settings);
    if (k === 'crt') renderer.setCRT?.(!!v);
    if (k === 'master' || k === 'sfx' || k === 'music') audio?.setVolume?.(settings.master, settings.sfx, settings.music);
    if (k === 'mute') audio?.setMute?.(!!v);
  };
  const fullscreen = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } catch { /* ignore */ } };
  const ui = createScreens({
    bus, art, settings,
    actions: {
      startGame: () => { if (!canGame) { flash('SIM NOT READY'); return; } startGame(); },
      quitToTitle: () => { game = null; playBot = null; if (!attract) startAttract(); bus.emit('music', { name: 'title' }); },
      setSetting: applySetting, toggleFullscreen: fullscreen, sfx: (n) => bus.emit('sfx', { name: n }),
    },
  });
  let notice = null;
  const flash = (text) => { notice = { text, until: performance.now() + 2500 }; };
  function startGame(o = {}) {
    game = newGame({ seed: o.seed ?? seedCounter++, startScreen: o.startScreen ?? num('screen', START_SCREEN), time: o.time ?? (q.has('time') ? num('time', TIME_LIMIT) : null) });
    playBot = flag('bot') ? makeBot(game) : null;
    if (flag('bot') && !playBot) console.warn('[pawfall] ?bot=1 but sim/autopilot.js is missing; human input is used');
    ui.onGameStart(); input.clear(); acc = 0; edge = false;
  }
  renderer.hud = (ctx, g) => {
    if (ui.mode === 'title' || (ui.isTitleLike() && g === attract)) { titleStrip(ctx); return; }
    if (ui.showHud()) hud.draw(ctx, g, { overlays: ui.mode !== 'end' && ui.mode !== 'pause' });
  };
  renderer.overlay = (ctx) => {
    ui.draw(ctx, game ?? attract, { hasAttract: !!attract });
    if (missing.length && (ui.isTitleLike() || !canGame)) drawMissing(ctx, missing);
    if (notice && performance.now() < notice.until) drawText(ctx, notice.text, W / 2, 182, { color: '#ff4a3a', shadow: '#1a1420', align: 'center' });
  };
  function titleStrip(ctx) {
    const hi = ui.hi[0]?.score ?? 0;
    ctx.fillStyle = '#0a0710'; ctx.fillRect(0, 0, W, 18);
    ctx.fillStyle = '#3a2f18'; ctx.fillRect(0, 17, W, 1);
    drawText(ctx, 'HI ' + String(hi).padStart(6, '0'), 4, 5, { color: '#ffd23a', shadow: '#3a2f18' });
    drawText(ctx, '1 PLAYER', W - 4, 5, { color: '#8d7a3a', shadow: '#3a2f18', align: 'right' });
  }

  // --- global actions
  input.on((e) => {
    if (e.act === 'mute') { applySetting('mute', !settings.mute); return; }
    if (e.act === 'crt') { applySetting('crt', settings.crt === false); return; }
    if (e.act === 'fullscreen') { fullscreen(); return; }
    if (e.act === 'pause' && ui.mode === 'title') return;
    ui.nav(e.act, e.key);
  });
  addEventListener('blur', () => { if (ui.mode === 'play') ui.pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.mode === 'play') ui.pause(); });
  if (canvas) canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || true) { if (ui.mode === 'title' || ui.mode === 'howto' || (ui.mode === 'end' && ui.end?.stage !== 'name')) input.act('confirm'); } });
  const touch = createTouch({ input, force: flag('touch') });

  // --- the loop
  let acc = 0, edge = false, last = performance.now(), manual = flag('manual'), override = null, prevOverrideJump = false;
  function humanInput(frameIn, first) { return stepInput({ ...frameIn, jumpPressed: edge && first }, 0); }
  function stepGameOnce(first, frameIn) {
    if (ui.stepsGame() && game) {
      let inp;
      if (ui.mode === 'end') inp = { dx: 0, dy: 0, jump: false, jumpPressed: false };
      else if (override) inp = override.next();
      else if (playBot) { try { inp = playBot(game, DT) || {}; } catch { inp = {}; } inp = { dx: inp.dx ?? 0, dy: inp.dy ?? 0, jump: !!inp.jump, jumpPressed: !!inp.jumpPressed }; }
      else inp = humanInput(frameIn, first);
      game.update(DT, inp);
      if (first) edge = false;
    } else if (ui.isTitleLike() && attract) {
      let inp = { dx: 0, dy: 0, jump: false, jumpPressed: false };
      if (attractBot) { try { inp = { ...inp, ...(attractBot(attract, DT) || {}) }; } catch { /* idle */ } }
      attract.update(DT, inp);
      attractAge += DT;
      if (attract.state === 'gameover' || attract.state === 'victory' || attractAge > 120) startAttract();
    }
  }
  function tick(dtw) {
    ui.update(dtw);
    const frameIn = input.poll();
    edge = edge || frameIn.jumpPressed;
    acc += dtw;
    let k = 0;
    while (acc >= DT && k < 5) { stepGameOnce(k === 0, frameIn); acc -= DT; k++; }
    if (k === 5) acc = 0;
  }
  function render() {
    const g = ui.isTitleLike() ? attract : (game ?? attract);
    try { renderer.draw(g ?? null, acc / DT); } catch (e) { if (!render.warned) { render.warned = true; console.error('[pawfall] render error', e); } }
  }
  function frame(now) {
    const dtw = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
    if (!manual) tick(dtw);
    render();
    requestAnimationFrame(frame);
  }

  // --- QA / tool hooks
  const pawfall = {
    get game() { return game ?? attract; }, get attract() { return attract; }, renderer, bus, ui, input, hud, art, settings, missing,
    /** Advance n fixed steps (works in manual mode too) and draw one frame. */
    step(n = 1) {
      for (let i = 0; i < n; i++) { ui.update(DT); stepGameOnce(true, override ? override.frame : { dx: 0, dy: 0, jump: false, jumpPressed: false }); }
      render(); return pawfall.game;
    },
    /** Hold an input state for subsequent steps: setInput({dx,dy,jump}) (jumpPressed is derived on the rising edge); null releases. */
    setInput(o) {
      if (!o) { override = null; prevOverrideJump = false; return; }
      const cur = { dx: o.dx ?? 0, dy: o.dy ?? 0, jump: !!o.jump };
      let pressedPending = cur.jump && !prevOverrideJump; prevOverrideJump = cur.jump;
      override = { frame: { ...cur, jumpPressed: false }, next() { const r = { ...cur, jumpPressed: pressedPending }; pressedPending = false; return r; } };
    },
    start(o) { if (canGame) startGame(o); return pawfall.game; },
    setManual(on) { manual = !!on; },
    key(act, key) { ui.nav(act, key); },
    get canGame() { return canGame; },
  };
  window.__pawfall = pawfall;

  // --- go
  if (canGame) startAttract();
  if (flag('autostart') || flag('bot') || q.has('screen')) { if (canGame) startGame(); }
  else bus.emit('music', { name: 'title' });
  if (bootEl) bootEl.classList.add('off');
  addEventListener('resize', () => renderer.resize?.());
  requestAnimationFrame((t) => { last = t; frame(t); });
  void touch;
}

function drawMissing(ctx, list) {
  const lines = list.slice(0, 4).map((s) => s.slice(0, 50));
  ctx.fillStyle = 'rgba(10,7,16,0.85)'; ctx.fillRect(0, H - 10 * (lines.length + 1), W, 10 * (lines.length + 1));
  lines.forEach((s, i) => drawText(ctx, s, 4, H - 10 * (lines.length + 1) + 3 + i * 9, { color: '#ff8fa3', shadow: '#1a1420' }));
}

/** Minimal stand-in when render/renderer.js (or art) is unavailable: dark backdrop + the UI overlays, integer-scaled. */
function fallbackRenderer(canvas, settings) {
  const out = canvas.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = W; buf.height = H;
  const b = buf.getContext('2d');
  const view = { s: 1, ox: 0, oy: 0 };
  const r = {
    hud: null, overlay: null, buffer: buf, viewport: view, fallback: true,
    resize() {
      const cw = Math.max(W, innerWidth), ch = Math.max(H, innerHeight), s = Math.max(1, Math.floor(Math.min(cw / W, ch / H)));
      canvas.width = cw; canvas.height = ch; Object.assign(view, { s, ox: Math.floor((cw - W * s) / 2), oy: Math.floor((ch - H * s) / 2) });
      out.imageSmoothingEnabled = false;
    },
    setCRT() {},
    draw(g) {
      const t = performance.now() / 1000;
      b.fillStyle = '#12182a'; b.fillRect(0, 0, W, H);
      b.fillStyle = '#1d7a2c'; b.fillRect(0, 130, W, 62); b.fillStyle = '#d9a441'; b.fillRect(0, 124, W, 8);
      drawText(b, 'PAWFALL', W / 2, 40 + Math.round(Math.sin(t * 2) * 2), { scale: 5, color: '#ffd23a', align: 'center' });
      b.fillStyle = '#0a0710'; b.fillRect(0, 0, W, 18);
      if (typeof r.hud === 'function' && g) r.hud(b, g);
      if (typeof r.overlay === 'function') r.overlay(b);
      out.fillStyle = '#000'; out.fillRect(0, 0, canvas.width, canvas.height);
      out.imageSmoothingEnabled = false; out.drawImage(buf, 0, 0, W, H, view.ox, view.oy, W * view.s, H * view.s);
    },
  };
  r.resize();
  return r;
}

boot().catch((e) => {
  console.error('[pawfall] boot failed', e);
  const el = document.getElementById('boot'); if (el) { el.classList.remove('off'); el.textContent = 'PAWFALL failed to start: ' + (e && e.message ? e.message : e); }
});
