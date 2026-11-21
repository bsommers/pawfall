#!/usr/bin/env node
// botplay: run the autopilot headless and report reach / deaths / score / time per seed.
//   (add --assist to make the player invulnerable in impossible wall windows)
//   node tools/botplay.mjs --stage 0 --round 1 --seeds 1..8 [--skill 1] [--lives 3] [--maxt 240] [--verbose]
// Exit code 1 if a skill=1 bot fails to clear stage 0 (round 1 only) on more than 25% of seeds.
import { createGame } from '../src/sim/game.js';
import { buildStage } from '../src/levels/index.js';
import { createAutopilot } from '../src/sim/autopilot.js';
import { STAGES, TUNING } from '../src/core/defs.js';

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
const stage = +opt('stage', 0), round = +opt('round', 1), skill = +opt('skill', 1);
const assist = !!opt('assist', false);
const seeds = parseSeeds(opt('seeds', '1..8')), lives = +opt('lives', 3), maxT = +opt('maxt', 300), verbose = !!opt('verbose', false);

const DT = 1 / 60;
const spd = TUNING.baseSpeed + Math.min(50, (round - 1) * TUNING.speedPerRound);
// level audit: windows of consecutive wall rows that no body-accurate path can pass (independent of the bot's position)
const auditor = createAutopilot({ seed: 1, player: {} }, { skill: 1 });
const auditBy = new Map();
for (const s of seeds) auditBy.set(s, auditor.auditStage(buildStage(stage, round, s), spd));
function run(seed) {
  const bus = { on() {}, emit() {} };
  const g = createGame({ seed, bus, round, stageIdx: stage, startStage: stage, buildStage, lives });
  const ap = createAutopilot(g, { skill });
  const deaths = []; let assisted = 0, prevState = g.state, maxY = 0, cleared = false, steps = 0;
  const t0 = Date.now();
  for (; g.t < maxT; steps++) {
    if (assist) {   // make the player invulnerable inside body-accurate impossible wall windows, to test the rest of the stage
      const py = g.player.y; if (auditBy.get(seed).some((b) => py > b.y - 40 && py < b.y + 120)) { g.player.invuln = Math.max(g.player.invuln, 0.3); assisted++; }
    }
    const inp = ap.input(g, DT);
    g.update(DT, inp);
    if (g.state === 'dying' && prevState !== 'dying') deaths.push({ y: Math.round(g.scrollY), cause: g.lastDeath, stage: g.stageIdx });
    prevState = g.state;
    if (g.stageIdx === stage) maxY = Math.max(maxY, g.scrollY);
    if (g.stageIdx !== stage || g.state === 'stageclear' || g.state === 'victory') { cleared = true; break; }
    if (g.state === 'gameover') break;
  }
  return { seed, cleared, gameover: g.state === 'gameover', deaths, maxY: Math.round(maxY), assisted, audit: auditBy.get(seed), score: g.score, time: +g.t.toFixed(1), fuel: Math.round(g.fuel), wall: Date.now() - t0, timeout: !cleared && g.state !== 'gameover' };
}

const len = STAGES[stage]?.length ?? 0;
console.log(`botplay stage=${stage} (${STAGES[stage]?.id}) round=${round} skill=${skill} lives=${lives} seeds=${seeds.join(',')}`);
const results = [];
for (const s of seeds) {
  const r = run(s); results.push(r);
  const dstr = r.deaths.map((d) => `${d.y}:${d.cause}`).join(' ');
  console.log(`seed ${String(s).padStart(3)} ${r.cleared ? 'CLEAR' : r.gameover ? 'DEAD ' : 'TIMEOUT'} reach=${Math.min(100, Math.round(100 * r.maxY / len))}% deaths=${r.deaths.length} score=${r.score} t=${r.time}s fuel=${r.fuel} (${r.wall}ms)${r.audit.length ? ' LEVEL-UNFAIR@y=' + r.audit.map((b) => b.y).join(',') : ''}${dstr ? ' [' + dstr + ']' : ''}`);
}
const fails = results.filter((r) => !r.cleared).length;
const hist = new Map();
for (const r of results) for (const d of r.deaths) { const k = Math.floor(d.y / 200) * 200; hist.set(k, (hist.get(k) || 0) + 1); }
if (hist.size) console.log('death hot spots (y bucket:count): ' + [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}-${k + 199}:${v}`).join('  '));
console.log(`summary: cleared ${results.length - fails}/${results.length}, deaths ${results.reduce((a, r) => a + r.deaths.length, 0)}, avg score ${Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)}`);
if (skill >= 1 && stage === 0 && round === 1 && fails / results.length > 0.25) { console.error('FAIL: skill=1 bot failed stage 0 on >25% of seeds'); process.exit(1); }
if (verbose) console.log(JSON.stringify(results));
