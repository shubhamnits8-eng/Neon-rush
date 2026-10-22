// Headless logic test: node tests/logic-test.mjs  (no browser needed)
import assert from 'node:assert/strict';
import { state } from '../src/storage.js';
import { Game } from '../src/game.js';
import { buy, select } from '../src/garage.js';
import { claim, MISSIONS, recordRun } from '../src/missions.js';
import { view } from '../src/renderer.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };
const g = new Game({});

ok('game starts (countdown -> playing)', () => {
  g.begin(); assert.equal(g.mode, 'countdown');
  for (let i = 0; i < 200 && g.mode !== 'playing'; i++) g.update(1 / 60);
  assert.equal(g.mode, 'playing'); assert.ok(g.objects.length > 0);
});
ok('score and distance increase, speed ramps', () => {
  const s0 = g.score; g.safe = 1; for (let i = 0; i < 60; i++) { g.objects.length = 0; g.update(1 / 60); }
  assert.ok(g.score > s0 && g.distance > 0 && g.speed > 0);
});
ok('orb pickup raises score, orbs, combo', () => {
  g.objects.length = 0; const s0 = g.score; g.alloc('orb', Math.round(g.laneX), 1);
  g.update(1 / 30); assert.equal(g.orbs, 1); assert.ok(g.score > s0 + 40); assert.equal(g.combo, 1);
});
ok('pause freezes and resume works', () => {
  assert.ok(g.pause()); const d = g.distance; g.update(0.5); assert.equal(g.distance, d);
  assert.ok(g.resume()); g.objects.length = 0; g.update(0.05); assert.ok(g.distance > d);
});
ok('shield absorbs one hit', () => {
  g.objects.length = 0; g.shield = 5; g.alloc('car', Math.round(g.laneX), 1); g.update(1 / 30);
  assert.equal(g.mode, 'playing'); assert.equal(g.shield, 0);
});
ok('collision without shield crashes and ends the run', () => {
  g.objects.length = 0; g.alloc('truck', Math.round(g.laneX), 1); g.update(1 / 30);
  assert.equal(g.mode, 'crashing'); for (let i = 0; i < 100 && g.mode !== 'over'; i++) g.update(1 / 30);
  assert.equal(g.mode, 'over'); assert.ok(g.summary && g.summary.score > 0 && g.summary.credits >= 2);
});
ok('no tunnelling at low FPS with boost speed', () => {
  g.begin(); for (let i = 0; i < 300 && g.mode !== 'playing'; i++) g.update(1 / 60);
  g.speed = 110; g.objects.length = 0; g.alloc('barrier', Math.round(g.laneX), 9); g.update(0.1);
  assert.equal(g.mode, 'crashing');
});
ok('restart works without reload', () => { g.begin(); assert.equal(g.mode, 'countdown'); assert.equal(g.score, 0); assert.equal(g.objects.length, 0); });
ok('generated rows always keep a free lane (2000 rows)', () => {
  g.reset(); g.time = 200; g.speed = 60;
  for (let i = 0; i < 2000; i++) {
    g.objects.length = 0; g.spawnRow(100);
    const blocked = new Set(g.objects.filter(o => ['car', 'truck', 'barrier'].includes(o.kind)).map(o => o.lane));
    assert.ok(blocked.size <= 3 && !blocked.has(g.safe));
  }
});
ok('garage: insufficient credits, buy, select', () => {
  state.credits = 0; assert.equal(buy('vortex').ok, false);
  state.credits = 1000; assert.equal(buy('vortex').ok, true); assert.equal(state.credits, 700);
  assert.equal(buy('vortex').ok, false); assert.equal(select('pulse').ok, true); assert.equal(select('aurora').ok, false);
});
ok('missions: claim only once', () => {
  state.best.distance = 5000; const c0 = state.credits;
  assert.equal(claim('d1').ok, true); assert.equal(claim('d1').ok, false); assert.equal(state.credits, c0 + 100);
  assert.equal(claim('s2').ok, false);
});
ok('recordRun updates high score, xp, credits', () => {
  const r = recordRun({ score: 99999, distance: 10, orbs: 1, time: 5, credits: 5 });
  assert.equal(r.newBest, true); assert.equal(state.highScore, 99999);
});
console.log(`\n${n} logic tests passed`);
