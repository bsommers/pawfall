// Checks the GitHub Pages showcase: relative assets resolve, and the swarm numbers match the plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = join(root, 'docs/site');
const html = readFileSync(join(siteDir, 'index.html'), 'utf8');

test('site: every local src/href resolves inside docs/site (no absolute paths)', () => {
  const live = html.replace(/<!--[\s\S]*?-->/g, '');
  const refs = [...live.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((r) => !/^(https?:|#|mailto:|data:)/.test(r));
  assert.ok(local.length > 0, 'expected local references');
  for (const ref of local) {
    assert.ok(!ref.startsWith('/'), `absolute path breaks on Pages: ${ref}`);
    if (ref === 'play/' || ref.startsWith('../')) continue; // play/ is deployed separately
    const file = ref.split(/[?#]/)[0];
    assert.ok(existsSync(join(siteDir, file)), `missing asset: ${ref}`);
  }
});

test('site: .nojekyll marker is present', () => {
  assert.ok(existsSync(join(siteDir, '.nojekyll')));
});

test('site: static swarm numbers match .tracker/plan.json', (t) => {
  const planPath = join(root, '.tracker/plan.json');
  if (!existsSync(planPath)) return t.skip('no .tracker/plan.json');
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const agents = plan.agents;
  const sonnet = agents.filter((a) => a.model === 'sonnet').length;
  const haiku = agents.filter((a) => a.model === 'haiku').length;
  assert.match(html, new RegExp(`data-count="agents"[^>]*>${agents.length}<|data-count="agents">${agents.length}<`));
  assert.match(html, new RegExp(`data-count="sonnet"[^>]*>${sonnet}<`));
  assert.match(html, new RegExp(`data-count="haiku"[^>]*>${haiku}<`));
});
