// Screen state machine: title (attract + menu + hi-scores), how-to-play, options, in-game, pause, and the end flow
// (game over / victory -> tally -> 3-letter name entry -> hi-score table). Everything is drawn into the 320x192 buffer.
// Node-safe: construct with fakes (bus, art, actions, storage) and call update/nav/draw.
import { W, H, PAL, TREASURE_COUNT, TUNING } from '../core/defs.js';
import { loadHi, saveHi, hiRank, insertHi } from '../core/settings.js';
import { drawText } from './font.js';
import { C, blink, panel, heading, dimmer, fmtScore, fmtClock, createMenu, createNameEntry, drawHiTable, drawHowTo } from './menus.js';

const NAME_KEY = 'pawfall.name';
const GAMEOVER_DELAY = 1.1, VICTORY_DELAY = 0.9;
const TITLE_MENU_SECS = 9, TITLE_HI_SECS = 6;

export function createScreens({ bus = null, art = null, settings = {}, storage = null, actions = {} } = {}) {
  const A = { startGame() {}, quitToTitle() {}, setSetting() {}, toggleFullscreen() {}, sfx() {}, music() {}, ...actions };
  const ui = {
    mode: 'title', t: 0, returnTo: 'title', hi: loadHi(storage), end: null, titleT: 0, helpFrom: 'title', settings,
  };
  const sfx = (n) => A.sfx(n);
  const lsGet = (k) => { try { return (storage || (typeof localStorage !== 'undefined' ? localStorage : null))?.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { (storage || (typeof localStorage !== 'undefined' ? localStorage : null))?.setItem(k, v); } catch { /* ignore */ } };

  // ---- menus
  const set = (k) => (v) => { ui.settings[k] = v; A.setSetting(k, v); };
  const titleMenu = createMenu([
    { label: 'START GAME', run: () => A.startGame() },
    { label: 'HOW TO PLAY', run: () => goto('howto', 'title') },
    { label: 'OPTIONS', run: () => goto('options', 'title') },
  ], { sfx });
  const optionItems = () => [
    { label: 'MASTER VOLUME', kind: 'slider', get: () => ui.settings.master ?? 0.8, set: set('master') },
    { label: 'SOUND FX', kind: 'slider', get: () => ui.settings.sfx ?? 1, set: set('sfx') },
    { label: 'MUSIC', kind: 'slider', get: () => ui.settings.music ?? 0.7, set: set('music') },
    { label: 'MUTE', kind: 'toggle', get: () => !!ui.settings.mute, set: set('mute') },
    { label: 'CRT FILTER', kind: 'toggle', get: () => ui.settings.crt !== false, set: set('crt') },
    { label: 'FULLSCREEN', run: () => A.toggleFullscreen() },
    { label: 'BACK', run: () => goto(ui.returnTo === 'options' ? 'title' : ui.returnTo) },
  ];
  let optMenu = createMenu(optionItems(), { sfx });
  const pauseMenu = createMenu([
    { label: 'RESUME', run: () => resume() },
    { label: 'OPTIONS', run: () => goto('options', 'pause') },
    { label: 'HOW TO PLAY', run: () => goto('howto', 'pause') },
    { label: 'QUIT TO TITLE', run: () => { ui.mode = 'title'; ui.titleT = 0; titleMenu.index = 0; A.quitToTitle(); } },
  ], { sfx });

  function goto(mode, from) {
    if (from) ui.returnTo = from;
    ui.mode = mode;
    if (mode === 'options') { optMenu = createMenu(optionItems(), { sfx }); }
    if (mode === 'title') { ui.titleT = 0; }
  }
  function resume() { ui.mode = 'play'; bus?.emit('pause', { on: false }); }
  function pause() { if (ui.mode !== 'play') return; ui.mode = 'pause'; pauseMenu.index = 0; bus?.emit('pause', { on: true }); sfx('menu_select'); }

  // ---- end flow (game over / victory)
  function beginEnd(kind, p) {
    ui.hi = loadHi(storage);
    const rank = hiRank(ui.hi, p.score ?? 0);
    ui.end = {
      kind, score: p.score ?? 0, treasures: p.treasures ?? 0, screens: p.screens ?? 0, timeBonus: p.timeBonus ?? 0, timeLeft: p.timeLeft ?? 0,
      wait: kind === 'victory' ? VICTORY_DELAY : GAMEOVER_DELAY, t: 0, stage: 'wait', rank, entry: null, saved: -1,
    };
    ui.mode = 'end';
  }
  function afterIntro() {
    const e = ui.end;
    if (e.rank >= 0) { e.stage = 'name'; e.entry = createNameEntry(lsGet(NAME_KEY) || 'AAA'); e.preview = insertHi(ui.hi, e.entry.name, e.score); }
    else e.stage = 'table';
  }
  function commitName() {
    const e = ui.end, name = e.entry.name;
    ui.hi = insertHi(ui.hi, name, e.score); saveHi(ui.hi, storage); lsSet(NAME_KEY, name);
    e.saved = ui.hi.findIndex((r) => r.name === name && r.score === Math.floor(e.score));
    e.stage = 'table'; e.t = 0; sfx('menu_select');
    bus?.emit('sfx', { name: 'oneup' });
  }
  if (bus) {
    bus.on('gameover', (p) => beginEnd('gameover', p || {}));
    bus.on('victory', (p) => beginEnd('victory', p || {}));
  }

  // ---- input
  ui.nav = function nav(act, key) {
    switch (ui.mode) {
      case 'title':
        if (ui.titleT >= TITLE_MENU_SECS) { ui.titleT = 0; if (act !== 'confirm') return true; }     // wake from the hi-score phase (confirm falls through = start)
        ui.titleT = Math.min(ui.titleT, 1);
        if (act === 'help') { goto('howto', 'title'); return true; }
        return titleMenu.nav(act);
      case 'howto': if (act === 'confirm' || act === 'back' || act === 'help') { sfx('menu_select'); goto(ui.returnTo); return true; } return false;
      case 'options':
        if (act === 'back') { sfx('menu_select'); goto(ui.returnTo); return true; }
        return optMenu.nav(act);
      case 'play': if (act === 'pause' || act === 'back') { pause(); return true; } return false;
      case 'pause':
        if (act === 'pause' || act === 'back') { sfx('menu_select'); resume(); return true; }
        return pauseMenu.nav(act);
      case 'end': {
        const e = ui.end; if (!e) return false;
        if (e.stage === 'wait') return false;
        if (e.stage === 'tally') { if (act === 'confirm') { if (e.t < 4.2) e.t = 4.2; else afterIntro(); return true; } return false; }
        if (e.stage === 'stats') { if (act === 'confirm') { afterIntro(); return true; } return false; }
        if (e.stage === 'name') {
          const r = e.entry.nav(act, key);
          if (r === 'done') commitName(); else if (r) { sfx('menu_move'); e.preview = insertHi(ui.hi, e.entry.name, e.score); }
          return !!r;
        }
        if (e.stage === 'table' && (act === 'confirm' || act === 'back')) { sfx('menu_select'); ui.end = null; ui.mode = 'title'; ui.titleT = 0; titleMenu.index = 0; A.quitToTitle(); return true; }
        return false;
      }
      default: return false;
    }
  };

  /** Called once when a run starts (title START, ?autostart). */
  ui.onGameStart = function onGameStart() { ui.mode = 'play'; ui.end = null; };
  ui.showHud = () => ui.mode === 'play' || ui.mode === 'pause' || ui.mode === 'end';
  /** Should main step the sim? (not on title/menus/pause; yes during the end-flow so the death/cheer animation plays). */
  ui.stepsGame = () => ui.mode === 'play' || ui.mode === 'end';
  ui.isTitleLike = () => ui.mode === 'title' || (ui.mode === 'howto' && ui.returnTo === 'title') || (ui.mode === 'options' && ui.returnTo === 'title');

  ui.update = function update(dt) {
    ui.t += dt;
    if (ui.mode === 'title') ui.titleT += dt;
    if (ui.titleT > TITLE_MENU_SECS + TITLE_HI_SECS) ui.titleT = 0;
    const e = ui.end;
    if (ui.mode === 'end' && e) {
      e.t += dt;
      if (e.stage === 'wait' && e.t >= e.wait) { e.stage = e.kind === 'victory' ? 'tally' : 'stats'; e.t = 0; if (e.kind === 'gameover') afterIntro(); }
      if (e.stage === 'tally' && e.t > 9) afterIntro();
    }
  };

  // ------------------------------------------------------------------ drawing
  const img = (n, f = 0) => { try { return art && art.has?.(n) !== false ? art.get(n, f) : null; } catch { return null; } };
  const put = (ctx, n, x, y, f = 0, s = 1) => { const i = img(n, f); if (!i) return false; if (s === 1) ctx.drawImage(i, Math.round(x), Math.round(y)); else ctx.drawImage(i, 0, 0, i.width, i.height, Math.round(x), Math.round(y), i.width * s, i.height * s); return true; };

  function drawTitle(ctx, hasAttract) {
    const t = ui.t;
    if (!hasAttract && !put(ctx, 'title_scene', 0, 0)) { /* renderer scene shows through */ }
    else if (!hasAttract) { /* title_scene drawn */ }
    // vignette + readability gradient
    ctx.fillStyle = 'rgba(10,7,16,0.30)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,7,16,0.38)'; ctx.fillRect(0, 100, W, H - 100);
    // logo (bobbing) or text fallback
    const bob = Math.round(Math.sin(t * 2) * 2);
    if (!put(ctx, 'logo', 48, 19 + bob)) { heading(ctx, 'PAWFALL', W / 2, 28 + bob, { scale: 6, t, wave: 2 }); }
    drawText(ctx, 'COLBY THE CAT vs PERRING PARKWAY PETE', W / 2, 79, { color: C.white, shadow: C.shadow, align: 'center' });
    const phaseHi = ui.titleT >= TITLE_MENU_SECS;
    // critters
    put(ctx, 'pete_laugh', 268, 148, Math.floor(t * 6) % 2);
    const cx = ((t * 24) % (W + 60)) - 30;
    if (!phaseHi) { put(ctx, 'colby_run', cx, 160, Math.floor(t * 12) % 6); }
    if (phaseHi) {
      panel(ctx, 70, 88, 180, 96);
      heading(ctx, 'HI-SCORES', W / 2, 92, { scale: 1, color: C.gold });
      drawHiTable(ctx, ui.hi, 80, 103, t, { rowH: 10, w: 156 });
      return;
    }
    panel(ctx, 76, 90, 168, 80);
    if (blink(t, 1.5)) drawText(ctx, 'PRESS SPACE', W / 2, 96, { scale: 2, color: C.gold, shadow: C.shadow, align: 'center' });
    titleMenu.draw(ctx, W / 2, 124, t, { gap: 13, w: 112 });
    drawText(ctx, 'ARROWS MOVE  SPACE JUMP  P PAUSE', W / 2, 178, { color: C.dim, shadow: C.shadow, align: 'center' });
  }

  function drawPause(ctx) {
    dimmer(ctx, 0.6);
    panel(ctx, 84, 40, 152, 110);
    heading(ctx, 'PAUSED', W / 2, 50, { scale: 3, t: ui.t, wave: 1 });
    pauseMenu.draw(ctx, W / 2, 86, ui.t, { gap: 14, w: 110 });
    drawText(ctx, 'P OR ESC TO RESUME', W / 2, 138, { color: C.dim, shadow: C.shadow, align: 'center' });
  }
  function drawOptions(ctx) {
    dimmer(ctx, ui.returnTo === 'title' ? 0.35 : 0.6);
    panel(ctx, 52, 24, 216, 144);
    heading(ctx, 'OPTIONS', W / 2, 33, { scale: 2, t: ui.t, wave: 1 });
    optMenu.draw(ctx, W / 2, 62, ui.t, { gap: 14, w: 168 });
  }

  const CONF = ['#ff4a3a', '#ffd23a', '#6cf06c', '#7ee8ff', '#ff8fa3', '#f08a24'];
  function confetti(ctx, t) {
    for (let i = 0; i < 70; i++) {
      const sp = 28 + (i * 37) % 40, x = ((i * 53.7) % W) + Math.sin(t * 2 + i) * 8, y = ((t * sp + i * 41) % (H + 12)) - 6;
      if (y < 0 || y > H - 4 || x < 0 || x > W - 4) continue;
      ctx.fillStyle = CONF[i % CONF.length];
      ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 2), 3 + ((i >> 1) % 2));
    }
  }
  function pile(ctx, cx, by, t) {
    const names = ['tr_gold', 'tr_collar', 'tr_sardine', 'tr_tuna'];
    const rows = [[0, 1, 2, 3, 4], [0, 1, 2, 3], [0, 1, 2], [0, 1]];
    rows.forEach((r, ri) => r.forEach((k, ci) => put(ctx, names[(ci + ri) % 4], cx - (r.length * 12) / 2 + ci * 12, by - (ri + 1) * 9, Math.floor(t * 3 + ci + ri) % 3)));
  }

  function drawEnd(ctx) {
    const e = ui.end; if (!e || e.stage === 'wait') return;
    const t = ui.t, vic = e.kind === 'victory';
    dimmer(ctx, vic ? 0.45 : 0.62);
    if (vic) confetti(ctx, t);
    heading(ctx, vic ? 'VICTORY!' : 'GAME OVER', W / 2, 22, { scale: 3, color: vic ? C.gold : C.red, t, wave: vic ? 2 : 1 });
    if (e.stage === 'tally') {
      const step = Math.floor(e.t / 0.8);
      panel(ctx, 70, 50, 180, 78);
      const row = (i, label, val, col = C.white) => { if (step >= i) { drawText(ctx, label, 82, 58 + i * 14, { color: C.dim, shadow: C.shadow }); drawText(ctx, val, 238, 58 + i * 14, { color: col, shadow: C.shadow, align: 'right' }); } };
      row(0, 'TREASURES', `${e.treasures}/${TREASURE_COUNT}`, C.gold);
      row(1, 'TIME LEFT', fmtClock(e.timeLeft || (e.timeBonus / (TUNING.timeBonusPerSec || 5))));
      row(2, 'TIME BONUS', '+' + Math.floor(e.timeBonus * Math.min(1, (e.t - 1.6) / 0.8)), C.green);
      if (step >= 3) { drawText(ctx, 'FINAL SCORE', 82, 58 + 3 * 14 + 4, { color: C.gold, shadow: C.shadow }); drawText(ctx, fmtScore(e.score), 238, 58 + 3 * 14 + 4, { color: blink(t, 4) ? C.white : C.gold, shadow: C.shadow, align: 'right' }); }
      put(ctx, 'colby_win', 22, 138, Math.floor(t * 4) % 3, 2);
      pile(ctx, W / 2, 188, t);
      const sh = Math.round(Math.sin(t * 30) * 1.5);
      put(ctx, 'pete_idle', 262 + sh, 142, 1);
      if (Math.floor(t * 2) % 2 === 0) drawText(ctx, 'CURSES!', 290, 134, { color: C.red, shadow: C.shadow, align: 'center' });
      if (e.t > 4.2 && blink(t, 1.5)) drawText(ctx, 'PRESS SPACE', W / 2, 136, { color: C.gold, shadow: C.shadow, align: 'center' });
      return;
    }
    // stats strip + table
    const y0 = 50;
    drawText(ctx, `SCORE ${fmtScore(e.score)}`, W / 2, y0, { scale: 2, color: C.white, shadow: C.shadow, align: 'center' });
    drawText(ctx, `TREASURES ${e.treasures}/${TREASURE_COUNT}    SCREENS ${e.screens}`, W / 2, y0 + 18, { color: C.dim, shadow: C.shadow, align: 'center' });
    panel(ctx, 70, 80, 180, 100);
    const label = e.stage === 'name' ? 'NEW HI-SCORE! ENTER NAME' : 'HI-SCORES';
    drawText(ctx, label, W / 2, 85, { color: e.stage === 'name' ? (blink(t, 3) ? C.white : C.gold) : C.gold, shadow: C.shadow, align: 'center' });
    if (e.stage === 'name') drawHiTable(ctx, e.preview, 80, 97, t, { rowH: 10, edit: { rank: e.rank, entry: e.entry }, w: 156 });
    else drawHiTable(ctx, ui.hi, 80, 97, t, { rowH: 10, hl: e.saved, w: 156 });
    if (!vic) put(ctx, 'pete_laugh', 270, 144, Math.floor(t * 6) % 2);
    const hint = e.stage === 'name' ? 'UP/DOWN LETTER  SPACE OK' : 'PRESS SPACE';
    if (e.stage !== 'name' ? blink(t, 1.5) : true) drawText(ctx, hint, W / 2, 183, { color: C.gold, shadow: C.shadow, align: 'center' });
  }

  /** The renderer overlay callback. `game` may be null. */
  ui.draw = function draw(ctx, game, { hasAttract = false } = {}) {
    switch (ui.mode) {
      case 'title': drawTitle(ctx, hasAttract); break;
      case 'howto': if (ui.returnTo === 'title') { drawTitle(ctx, hasAttract); } dimmer(ctx, 0.5); drawHowTo(ctx, art, ui.t); break;
      case 'options': if (ui.returnTo === 'title') drawTitle(ctx, hasAttract); drawOptions(ctx); break;
      case 'pause': drawPause(ctx); break;
      case 'end': drawEnd(ctx); break;
      default: break;
    }
  };
  ui.titleMenu = titleMenu; ui.pauseMenu = pauseMenu; ui.pause = pause; ui.resume = resume; ui.goto = goto;
  return ui;
}
