// game.js - game rules and simulation (no drawing here). Frame-rate independent using delta time.
import { selectedVehicle } from './garage.js';
import { recordRun } from './missions.js';
import { LANES, LW, ZMAX, proj, Particles, fxState } from './renderer.js';

const rnd = Math.random, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const KINDS = {
  barrier: { half: 0.8, w: 0.62 }, car: { half: 1.6, w: 0.62 }, truck: { half: 2.6, w: 0.7 },
  orb: { half: 0.7, w: 0.62 }, shield: { half: 0.7, w: 0.62 }
};
const TRAFFIC = ['#ff3b5c', '#ff9f1a', '#5aa9ff', '#b57bff', '#e8e8ff'];

export class Game {
  constructor(ev) {
    this.ev = ev || {};
    this.fx = new Particles(280);
    this.P = { x: 0, y: 0, s: 1 };
    this.pool = []; this.objects = []; this.popups = [];
    for (let i = 0; i < 8; i++) this.popups.push({ t: '', x: 0, y: 0, life: 0, c: '#fff' });
    this.mode = 'idle'; this.scroll = 0; this.t = 0; this.trailT = 0;
    this.reset(); this.lane = 1.5;
  }

  reset() {
    const v = this.veh = selectedVehicle();
    this.stats = { vBase: 34 + v.speed * 1.6, vMax: 68 + v.speed * 3.2, rate: 9 + v.handling * 1.3, regen: 3 + v.boost * 0.6, boostMul: 1.3 + v.boost * 0.04 };
    for (const o of this.objects) this.pool.push(o);
    this.objects.length = 0; this.fx.clear();
    for (const p of this.popups) p.life = 0;
    this.lane = 1; this.laneX = 1.5; this.safe = 1;
    this.speed = 0; this.vEff = 0; this.bf = 0; this.time = 0; this.distance = 0; this.score = 0;
    this.orbs = 0; this.combo = 0; this.mult = 1; this.comboT = 0;
    this.boost = 50; this.boosting = false; this.wantBoost = false; this.boostLock = false; this.shield = 0;
    this.spawnAcc = 0; this.nextGap = 60; this.crashT = 0; this.cd = 0; this.goT = 0; this.shake = 0; this.flash = 0;
    this.summary = null; this._cdN = 0;
  }

  get credits() { return this.orbs * 2 + Math.floor(this.distance / 100); }
  get speedNorm() { return clamp((this.vEff || 0) / (this.stats.vMax * 1.2), 0, 1); }

  toIdle() { this.reset(); this.lane = 1.5; this.mode = 'idle'; }
  begin() { this.reset(); this.mode = 'countdown'; this.cd = 3; this._cdN = 4; }
  pause() { if (this.mode === 'playing') { this.mode = 'paused'; this.setBoost(false); return true; } return false; }
  resume() { if (this.mode === 'paused') { this.mode = 'playing'; return true; } return false; }
  get active() { return this.mode === 'playing' || this.mode === 'countdown' || this.mode === 'paused'; }

  moveLane(d) {
    if (this.mode !== 'playing' && this.mode !== 'countdown') return;
    const n = clamp(Math.round(this.lane) + d, 0, LANES - 1);
    if (n !== this.lane) { this.lane = n; if (this.ev.move) this.ev.move(); }
  }
  setBoost(on) { this.wantBoost = on; if (!on) this.boostLock = false; }

  popup(text, color) {
    proj(this.laneX, 0, this.P);
    for (const p of this.popups) if (p.life <= 0) { p.t = text; p.c = color; p.x = this.P.x; p.y = this.P.y - 90; p.life = 1; return; }
  }

  alloc(kind, lane, z) {
    const o = this.pool.pop() || {}, K = KINDS[kind];
    o.kind = kind; o.lane = lane; o.z = z; o.half = K.half; o.w = K.w; o.dead = false; o.color = '';
    this.objects.push(o); return o;
  }

  // Fair row generation: a "safe lane" moves at most one lane per row and is never blocked.
  spawnRow(z) {
    const d = Math.min(1, this.time / 100);
    const r = rnd(); this.safe = clamp(this.safe + (r < 0.34 ? -1 : r < 0.67 ? 0 : 1), 0, LANES - 1);
    let n = 1 + (rnd() < 0.35 + 0.4 * d ? 1 : 0) + (rnd() < 0.5 * d ? 1 : 0);
    n = Math.min(n, LANES - 1);
    const lanes = []; for (let i = 0; i < LANES; i++) if (i !== this.safe) lanes.push(i);
    for (let i = lanes.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = lanes[i]; lanes[i] = lanes[j]; lanes[j] = t; }
    for (let i = 0; i < n; i++) {
      const q = rnd();
      const kind = (this.time > 12 && q < 0.2 + 0.15 * d) ? 'truck' : q < 0.55 ? 'barrier' : 'car';
      const o = this.alloc(kind, lanes[i], z);
      if (kind === 'car') o.color = TRAFFIC[(rnd() * TRAFFIC.length) | 0];
    }
    const gap = Math.max(30, this.speed * (0.8 + rnd() * 0.5));
    this.nextGap = gap;
    const q = rnd();
    if (q < 0.1) this.alloc('shield', this.safe, z + gap * 0.4);
    else if (q < 0.8) { const cnt = 3 + ((rnd() * 2) | 0); for (let i = 0; i < cnt; i++) this.alloc('orb', this.safe, z + gap * 0.15 + i * 2.4); }
  }

  update(dt) {
    const m = this.mode; this.t += dt;
    if (m === 'paused' || m === 'over') return;
    this.shake = Math.max(0, this.shake - dt * 30); this.flash = Math.max(0, this.flash - dt * 2.2);
    for (const p of this.popups) if (p.life > 0) p.life -= dt * 1.1;
    if (m === 'idle') { this.scroll += dt * 16; this.trail(dt); this.fx.update(dt); return; }
    if (m === 'countdown') {
      this.cd -= dt; this.scroll += dt * 14;
      this.laneX += (this.lane - this.laneX) * (1 - Math.exp(-this.stats.rate * dt));
      const n = Math.ceil(this.cd);
      if (n !== this._cdN && n > 0) { this._cdN = n; if (this.ev.count) this.ev.count(n); }
      if (this.cd <= 0) {
        this.mode = 'playing'; this.goT = 0.7; this.speed = this.stats.vBase * 0.7;
        this.spawnRow(100); this.nextGap = ZMAX - 100; this.spawnAcc = 0;
        if (this.ev.go) this.ev.go();
      }
      this.trail(dt); this.fx.update(dt); return;
    }
    this.goT = Math.max(0, this.goT - dt);
    let rem = Math.min(dt, 0.1);
    while (rem > 1e-5 && this.mode !== 'over') { const h = Math.min(rem, 0.025); this.step(h); rem -= h; }
    this.trail(dt); this.fx.update(dt);
  }

  step(h) {
    const st = this.stats;
    if (this.mode === 'crashing') {
      this.speed *= Math.exp(-4 * h); this.vEff = this.speed; this.scroll += this.speed * h;
      for (const o of this.objects) o.z -= this.speed * h;
      this.crashT += h; if (this.crashT > 1.1) this.finish();
      return;
    }
    this.time += h;
    const target = Math.min(st.vMax, st.vBase + this.time * 0.45);
    this.speed += (target - this.speed) * Math.min(1, h * 1.5);
    const can = this.wantBoost && !this.boostLock && this.boost > 0 && (this.boosting || this.boost >= 8);
    if (can) {
      if (!this.boosting) { this.boosting = true; if (this.ev.boost) this.ev.boost(true); }
      this.boost = Math.max(0, this.boost - 30 * h);
      if (this.boost <= 0) this.boostLock = true;
    } else {
      if (this.boosting) { this.boosting = false; if (this.ev.boost) this.ev.boost(false); }
      this.boost = Math.min(100, this.boost + st.regen * h);
    }
    this.bf += ((this.boosting ? 1 : 0) - this.bf) * Math.min(1, h * 6);
    const v = this.vEff = this.speed * (1 + (st.boostMul - 1) * this.bf);
    const dz = v * h;
    this.scroll += dz; this.distance += dz;
    this.score += dz * 0.6 * (this.boosting ? 1.5 : 1) * (1 + (this.mult - 1) * 0.5);
    this.laneX += (this.lane - this.laneX) * (1 - Math.exp(-st.rate * h));
    if (this.combo > 0) { this.comboT -= h; if (this.comboT <= 0) { this.combo = 0; this.mult = 1; } }
    if (this.shield > 0) this.shield = Math.max(0, this.shield - h);

    this.spawnAcc += dz;
    while (this.spawnAcc >= this.nextGap) { this.spawnAcc -= this.nextGap; this.spawnRow(ZMAX - this.spawnAcc); }

    const arr = this.objects;
    for (let i = arr.length - 1; i >= 0; i--) {
      const o = arr[i], zp = o.z; o.z -= dz;
      // swept test so fast speeds / low FPS can never tunnel through an object
      if (!o.dead && o.z - o.half <= 0.5 && zp + o.half >= -0.5 && Math.abs(o.lane - this.laneX) < o.w) this.touch(o);
      if (o.dead || o.z < -8) { arr.splice(i, 1); this.pool.push(o); }
      if (this.mode === 'crashing') break;
    }
  }

  touch(o) {
    proj(this.laneX, 0, this.P);
    if (o.kind === 'orb') {
      o.dead = true; this.orbs++; this.combo++; this.comboT = 3;
      const nm = 1 + Math.min(4, Math.floor(this.combo / 4));
      this.score += 50 * nm; this.boost = Math.min(100, this.boost + 8);
      if (nm > this.mult) this.popup('x' + nm + ' COMBO!', '#ff2bd6'); else this.popup('+' + 50 * nm, '#00e5ff');
      this.mult = nm;
      this.fx.burst(this.P.x, this.P.y - 30, 8, 140, ['#00e5ff', '#ffffff'], 3);
      if (this.ev.orb) this.ev.orb(this.combo);
    } else if (o.kind === 'shield') {
      o.dead = true; this.shield = 7; this.popup('SHIELD!', '#38ff9c');
      this.fx.burst(this.P.x, this.P.y - 30, 16, 180, ['#38ff9c', '#ffffff'], 3);
      if (this.ev.shield) this.ev.shield();
    } else if (this.shield > 0) {
      this.shield = 0; o.dead = true; this.shake = 9; this.flash = 0.3; this.popup('SHIELD BROKEN', '#ff9f1a');
      this.fx.burst(this.P.x, this.P.y - 30, 30, 260, ['#00e5ff', '#ff9f1a', '#ffffff'], 4);
      if (this.ev.shieldBreak) this.ev.shieldBreak();
    } else this.crash();
  }

  crash() {
    this.mode = 'crashing'; this.crashT = 0;
    if (this.boosting) { this.boosting = false; if (this.ev.boost) this.ev.boost(false); }
    this.combo = 0; this.mult = 1; this.shake = 18; this.flash = 1;
    proj(this.laneX, 0, this.P);
    this.fx.burst(this.P.x, this.P.y - 20, 70, 380, ['#00e5ff', '#ff2bd6', '#ffffff', '#ff9f1a'], 4.5);
    if (this.ev.crash) this.ev.crash();
  }

  finish() {
    const s = { score: Math.floor(this.score), distance: Math.floor(this.distance), orbs: this.orbs, time: Math.floor(this.time), credits: this.credits };
    const r = recordRun(s);
    s.newBest = r.newBest; s.completed = r.completed; s.leveledUp = r.leveledUp; s.xpGain = r.xpGain;
    this.summary = s; this.mode = 'over';
    if (this.ev.over) this.ev.over(s);
  }

  trail(dt) {
    if (fxState.reduced) return;
    this.trailT += dt;
    if (this.trailT < 0.045) return;
    this.trailT = 0;
    if (this.mode === 'crashing') return;
    proj(this.laneX, 0, this.P);
    const b = this.boosting, v = this.veh, sn = this.speedNorm;
    for (let k = 0; k < (b ? 3 : 1); k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      this.fx.spawn(this.P.x + side * LW * 0.22, this.P.y - 6, side * (8 + rnd() * 28), 50 + rnd() * 70 + sn * 60, 0.3 + rnd() * 0.25, 2 + rnd() * 2, b ? (rnd() < 0.5 ? '#ff9f1a' : '#ffffff') : v.color);
    }
  }
}
