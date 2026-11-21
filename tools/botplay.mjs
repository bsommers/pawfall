#!/usr/bin/env node
// botplay: run the autopilot headless over the full 120-screen world; report treasures / deaths / time / score per seed.
//   node tools/botplay.mjs [--seeds 1..4] [--skill 1] [--maxt 1200] [--start 0] [--verbose]
// Exit code 1 if a skill=1 bot collects < 28 treasures within the time limit on more than half of the seeds.
import { createGame } from '../src/sim/game.js';
import { screenAt } from '../src/levels/world.js';
import { createAutopilot } from '../src/sim/autopilot.js';
import { TIME_LIMIT, DT, TREASURE_COUNT } from '../src/core/defs.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] === undefined || args[i + 1].startsWith('--') ? true : args[i + 1]); };
function parseSeeds(s) {
  const out = [];
  for (const part of String(s).split(',')) {
    const m = part.match(/^(\d+)\.\.(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i); else if (part !== '') out.push(+part);
  }
  return out;
}
const skill = +opt('skill', 1), seeds = parseSeeds(opt('seeds', '1..4')), maxT = +opt('maxt', TIME_LIMIT + 60), start = +opt('start', 0), verbose = !!opt('verbose', false);
const need = +opt('need', 28);

export function runBot(seed, { skill = 1, maxT = TIME_LIMIT + 60, start = 0, trace = false } = {}) {
  const bus = { on() {}, emit() {} };
  const g = createGame({ seed, bus, screenAt, startScreen: start });
  const ap = createAutopilot(g, { skill });
  const deaths = [], t0 = Date.now(), tre = [];
  let prevState = g.state, prevCount = 0, lastProgress = 0, lastKey = '';
  const causes = {};
  const origKill = g.kill;
  g.kill = (reason, src) => { const before = g.state; origKill(reason, src); if (before === 'play' && g.state === 'dying') { deaths.push({ screen: g.screenIdx, x: Math.round(g.player.x), reason, t: +g.t.toFixed(1) }); causes[reason] = (causes[reason] ?? 0) + 1; } };
  while (g.t < maxT) {
    g.update(DT, ap.input(g, DT));
    if (g.treasureCount !== prevCount) { prevCount = g.treasureCount; tre.push({ n: prevCount, t: +g.t.toFixed(1), screen: g.screenIdx }); }
    if (g.state === 'gameover' || g.state === 'victory') break;
    prevState = g.state;
  }
  return { seed, state: g.state, treasures: g.treasureCount, deaths, causes, score: g.score, time: +g.t.toFixed(1), timeLeft: +g.timeLeft.toFixed(1), lives: g.lives,
    screens: g.visited.size, wall: Date.now() - t0, tre, stats: ap.stats };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`botplay skill=${skill} seeds=${seeds.join(',')} maxT=${maxT}s start=${start} (need >= ${need}/${TREASURE_COUNT} treasures)`);
  const results = [];
  for (const s of seeds) {
    const r = runBot(s, { skill, maxT, start }); results.push(r);
    const dstr = r.deaths.map((d) => `s${d.screen}@${d.x}:${d.reason}`).join(' ');
    console.log(`seed ${String(s).padStart(3)} ${r.state.toUpperCase().padEnd(8)} treasures=${String(r.treasures).padStart(2)}/${TREASURE_COUNT} deaths=${r.deaths.length} score=${r.score} t=${r.time}s left=${r.timeLeft}s screens=${r.screens} (${r.wall}ms)${dstr ? ' [' + dstr + ']' : ''}${r.stats.errors ? ' ERRORS=' + r.stats.errors : ''}`);
    if (r.stats.lastError) console.log('  ' + r.stats.lastError.split('\n').slice(0, 3).join(' | '));
  }
  const good = results.filter((r) => r.treasures >= need).length;
  const hot = new Map();
  for (const r of results) for (const d of r.deaths) { const k = `s${d.screen}:${d.reason}`; hot.set(k, (hot.get(k) ?? 0) + 1); }
  if (hot.size) console.log('death hot spots: ' + [...hot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}x${v}`).join('  '));
  console.log(`summary: ${good}/${results.length} seeds reached >= ${need} treasures, avg treasures ${(results.reduce((a, r) => a + r.treasures, 0) / results.length).toFixed(1)}, deaths ${results.reduce((a, r) => a + r.deaths.length, 0)}, avg score ${Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)}`);
  if (verbose) console.log(JSON.stringify(results));
  if (skill >= 1 && good / results.length <= 0.5) { console.error(`FAIL: skill=1 bot reached >= ${need} treasures on only ${good}/${results.length} seeds`); process.exit(1); }
}
