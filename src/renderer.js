// renderer.js - all Canvas drawing: pseudo-3D neon road, skyline, vehicles, particles, effects.
export const LANES = 4, LW = 96, ZMAX = 170, ZD = 26;
export const view = { W: 480, H: 640, hor: 192, yp: 500, cx: 240 };
export const fxState = { q: 1, reduced: false };
const TAU = Math.PI * 2;
const FONT = '"Arial Black", Impact, "Segoe UI", sans-serif';

export function proj(lane, z, o) {
  const s = 1 / (1 + z / ZD);
  o.s = s;
  o.x = view.cx + (lane - (LANES - 1) / 2) * LW * s;
  o.y = view.hor + (view.yp - view.hor) * s;
  return o;
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- Particle pool (fixed size, no per-frame allocation) ----------
export class Particles {
  constructor(n) {
    this.n = n; this.i = 0;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.size = new Float32Array(n);
    this.col = new Array(n).fill('#fff');
  }
  spawn(x, y, vx, vy, life, size, col) {
    if (fxState.q < 1 && Math.random() > fxState.q) return;
    const i = this.i; this.i = (i + 1) % this.n;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.col[i] = col;
  }
  burst(x, y, n, speed, cols, size) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = speed * (0.2 + Math.random() * 0.8);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.7, size * (0.5 + Math.random()), cols[(Math.random() * cols.length) | 0]);
    }
  }
  clear() { this.life.fill(0); }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] > 0) { this.life[i] -= dt; this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.vy[i] += 120 * dt; }
    }
  }
  draw(c) {
    c.globalCompositeOperation = fxState.q >= 1 ? 'lighter' : 'source-over';
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      c.globalAlpha = Math.min(1, this.life[i] / this.max[i]);
      c.fillStyle = this.col[i];
      const s = this.size[i];
      c.fillRect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
}

// ---------- Vehicle / object drawing helpers ----------
// (x, y) = bottom centre of the vehicle, w = width in pixels. Rear view.
export function drawCar(c, x, y, w, body, accent, st, boost, t) {
  const s = st || {}, h = w * 0.6, bw = w * (s.wide || 0.94);
  c.globalAlpha = 0.3; c.fillStyle = body;
  c.beginPath(); c.ellipse(x, y, w * 0.62, h * 0.16, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
  c.fillStyle = '#05060f';
  rr(c, x - w * 0.5, y - h * 0.34, w * 0.17, h * 0.34, w * 0.03); c.fill();
  rr(c, x + w * 0.33, y - h * 0.34, w * 0.17, h * 0.34, w * 0.03); c.fill();
  c.fillStyle = body; rr(c, x - bw / 2, y - h * 0.66, bw, h * 0.52, w * 0.08); c.fill();
  c.fillStyle = 'rgba(0,0,20,.35)'; rr(c, x - bw / 2, y - h * 0.3, bw, h * 0.16, w * 0.05); c.fill();
  const cw = w * (s.cabin || 0.6), ch = h * (s.cabinH || 0.34);
  c.fillStyle = '#070a22'; c.beginPath();
  c.moveTo(x - cw / 2, y - h * 0.64); c.lineTo(x - cw * 0.36, y - h * 0.64 - ch);
  c.lineTo(x + cw * 0.36, y - h * 0.64 - ch); c.lineTo(x + cw / 2, y - h * 0.64); c.closePath(); c.fill();
  c.strokeStyle = accent; c.globalAlpha = 0.55; c.lineWidth = Math.max(1, w * 0.015); c.stroke(); c.globalAlpha = 1;
  if (s.stripe) { c.fillStyle = accent; c.fillRect(x - w * 0.035, y - h * 0.66, w * 0.07, h * 0.5); }
  if (s.spoiler) {
    c.fillStyle = accent; rr(c, x - bw * 0.56, y - h * 0.78, bw * 1.12, h * 0.08, w * 0.02); c.fill();
    c.fillRect(x - bw * 0.3, y - h * 0.7, w * 0.04, h * 0.06); c.fillRect(x + bw * 0.26, y - h * 0.7, w * 0.04, h * 0.06);
  }
  const lc = s.light || '#ff2a4d';
  c.fillStyle = lc;
  if (s.bar) { rr(c, x - bw * 0.46, y - h * 0.52, bw * 0.92, h * 0.07, w * 0.02); c.fill(); }
  else { rr(c, x - bw * 0.46, y - h * 0.54, bw * 0.24, h * 0.1, w * 0.02); c.fill(); rr(c, x + bw * 0.22, y - h * 0.54, bw * 0.24, h * 0.1, w * 0.02); c.fill(); }
  c.globalAlpha = 0.25; c.fillRect(x - bw * 0.5, y - h * 0.6, bw, h * 0.2); c.globalAlpha = 1;
  if (boost > 0.05) {
    const fl = 0.7 + 0.3 * Math.sin(t * 70), len = h * (0.5 + boost * 0.7) * fl;
    for (const sx of [-1, 1]) {
      const fx = x + sx * bw * 0.3, fy = y - h * 0.2;
      c.fillStyle = '#ff9f1a'; c.beginPath(); c.moveTo(fx - w * 0.07, fy); c.lineTo(fx + w * 0.07, fy); c.lineTo(fx, fy + len); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(fx - w * 0.03, fy); c.lineTo(fx + w * 0.03, fy); c.lineTo(fx, fy + len * 0.5); c.fill();
    }
  }
}

function drawTruck(c, x, y, w) {
  const h = w * 1.0;
  c.fillStyle = 'rgba(255,122,26,.25)'; c.beginPath(); c.ellipse(x, y, w * 0.6, h * 0.1, 0, 0, TAU); c.fill();
  c.fillStyle = '#05060f'; c.fillRect(x - w * 0.46, y - h * 0.12, w * 0.16, h * 0.12); c.fillRect(x + w * 0.3, y - h * 0.12, w * 0.16, h * 0.12);
  c.fillStyle = '#1b2147'; rr(c, x - w * 0.5, y - h, w, h * 0.9, w * 0.04); c.fill();
  c.strokeStyle = '#3c4a9a'; c.lineWidth = Math.max(1, w * 0.02); c.stroke();
  c.fillStyle = '#2b3470'; c.fillRect(x - w * 0.01, y - h * 0.95, w * 0.02, h * 0.8);
  c.fillStyle = '#ffd24a'; c.fillRect(x - w * 0.5, y - h * 0.3, w, h * 0.05);
  c.fillStyle = '#ff6a00'; c.fillRect(x - w * 0.44, y - h * 0.22, w * 0.16, h * 0.1); c.fillRect(x + w * 0.28, y - h * 0.22, w * 0.16, h * 0.1);
}

function drawBarrier(c, x, y, w) {
  const h = w * 0.3;
  c.fillStyle = 'rgba(255,43,214,.3)'; c.beginPath(); c.ellipse(x, y, w * 0.6, h * 0.35, 0, 0, TAU); c.fill();
  const n = 6, sw = w / n;
  for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff2bd6'; c.fillRect(x - w / 2 + i * sw, y - h, sw + 0.5, h); }
  c.fillStyle = '#12123a'; c.fillRect(x - w * 0.42, y - h * 0.15, w * 0.1, h * 0.15); c.fillRect(x + w * 0.32, y - h * 0.15, w * 0.1, h * 0.15);
}

function drawPickup(c, x, y, r, t, shield) {
  const col = shield ? '#38ff9c' : '#00e5ff';
  c.globalAlpha *= 1; c.fillStyle = shield ? 'rgba(56,255,156,.25)' : 'rgba(0,229,255,.25)';
  c.beginPath(); c.arc(x, y, r * 2.1, 0, TAU); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * 0.42, 0, TAU); c.fill();
  if (shield) { c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, r * 0.18); c.beginPath(); c.arc(x, y, r * 1.5 + Math.sin(t * 6) * r * 0.1, 0, TAU); c.stroke(); }
}

export function drawCarPreview(canvas, v) {
  const c = canvas.getContext('2d');
  if (!c) return;
  c.clearRect(0, 0, canvas.width, canvas.height);
  const g = c.createRadialGradient(canvas.width / 2, canvas.height * 0.8, 5, canvas.width / 2, canvas.height * 0.8, canvas.width * 0.6);
  g.addColorStop(0, v.color + '55'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, canvas.width, canvas.height);
  drawCar(c, canvas.width / 2, canvas.height * 0.86, canvas.width * 0.6, v.color, v.accent, v.style, 0, 0);
}

// ---------- Main renderer ----------
export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    if (!this.c) throw new Error('Canvas 2D is not supported in this browser.');
    this.P = { x: 0, y: 0, s: 1 }; this.sx = 1; this.sy = 1; this.layers = [];
    this.lines = []; for (let i = 0; i < 26; i++) this.lines.push({ a: Math.random() * TAU, p: Math.random() });
  }

  mk(wl, hl) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(wl * this.sx)); cv.height = Math.max(1, Math.ceil(hl * this.sy));
    const c = cv.getContext('2d'); c.scale(this.sx, this.sy);
    return [cv, c];
  }

  resize(w, h, dprCap) {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap || 2);
    const W = 480, H = Math.round(W * h / w);
    view.W = W; view.H = H; view.hor = Math.round(H * 0.3); view.yp = Math.round(H * 0.78); view.cx = W / 2;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.sx = this.cv.width / W; this.sy = this.cv.height / H;
    this.build();
  }

  build() {
    const { W, H, hor, cx } = view, c = this.c, rng = seeded(11);
    // sky + stars + neon sun + ground base
    const [bg, b] = this.mk(W, H); this.bg = bg;
    let g = b.createLinearGradient(0, 0, 0, hor);
    g.addColorStop(0, '#03041a'); g.addColorStop(0.55, '#170a48'); g.addColorStop(0.88, '#4a1585'); g.addColorStop(1, '#c02aa0');
    b.fillStyle = g; b.fillRect(0, 0, W, hor);
    b.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) { b.globalAlpha = 0.25 + rng() * 0.6; b.fillRect(rng() * W, rng() * hor * 0.8, 1.5, 1.5); }
    b.globalAlpha = 1;
    const sxp = W * 0.72, syp = hor * 0.48, sr = Math.min(48, hor * 0.2);
    g = b.createLinearGradient(0, syp - sr, 0, syp + sr); g.addColorStop(0, '#ffe66b'); g.addColorStop(1, '#ff2bd6');
    b.fillStyle = 'rgba(255,43,214,.18)'; b.beginPath(); b.arc(sxp, syp, sr * 1.8, 0, TAU); b.fill();
    b.fillStyle = g; b.beginPath(); b.arc(sxp, syp, sr, 0, TAU); b.fill();
    b.fillStyle = '#2a0b57'; for (let i = 0; i < 5; i++) b.fillRect(sxp - sr, syp + sr * 0.1 + i * sr * 0.18, sr * 2, 1 + i * 0.9);
    b.fillStyle = '#05051a'; b.fillRect(0, hor, W, H - hor);

    // skyline layers (pre-rendered once, only translated per frame)
    const defs = [
      { k: 6, col: '#1a1450', hmin: 0.25, hmax: 0.5, wmin: 22, wmax: 40, edge: 'rgba(0,229,255,.25)', win: 0.12 },
      { k: 12, col: '#0f0b34', hmin: 0.3, hmax: 0.7, wmin: 26, wmax: 48, edge: 'rgba(255,43,214,.45)', win: 0.25 },
      { k: 22, col: '#080720', hmin: 0.35, hmax: 0.95, wmin: 30, wmax: 56, edge: 'rgba(0,229,255,.7)', win: 0.3 }
    ];
    this.layers = defs.map(d => {
      const [lc, l] = this.mk(W + 120, hor);
      let x = 0; const wins = [[], []];
      while (x < W + 120) {
        const bw = d.wmin + rng() * (d.wmax - d.wmin), bh = hor * (d.hmin + rng() * (d.hmax - d.hmin)), top = hor - bh;
        l.fillStyle = d.col; l.fillRect(x, top, bw, bh);
        l.fillStyle = d.edge; l.fillRect(x, top, bw, 1.5);
        for (let wy = top + 8; wy < hor - 6; wy += 8) for (let wx = x + 4; wx < x + bw - 5; wx += 7) {
          if (rng() < d.win) wins[rng() < 0.55 ? 0 : 1].push(wx, wy);
        }
        x += bw + 2 + rng() * 6;
      }
      l.fillStyle = 'rgba(0,229,255,.8)'; for (let i = 0; i < wins[0].length; i += 2) l.fillRect(wins[0][i], wins[0][i + 1], 3, 4);
      l.fillStyle = 'rgba(255,43,214,.8)'; for (let i = 0; i < wins[1].length; i += 2) l.fillRect(wins[1][i], wins[1][i + 1], 3, 4);
      return { cv: lc, k: d.k };
    });

    // cached gradients
    this.fog = c.createLinearGradient(0, hor - 40, 0, hor + 30);
    this.fog.addColorStop(0, 'rgba(255,43,214,0)'); this.fog.addColorStop(0.6, 'rgba(255,43,214,.32)'); this.fog.addColorStop(1, 'rgba(255,43,214,0)');
    this.gnd = c.createLinearGradient(0, hor, 0, H); this.gnd.addColorStop(0, '#2a0a45'); this.gnd.addColorStop(0.3, '#0a0824'); this.gnd.addColorStop(1, '#05051a');
    this.road = c.createLinearGradient(0, hor, 0, H); this.road.addColorStop(0, '#201447'); this.road.addColorStop(0.4, '#0d0b2c'); this.road.addColorStop(1, '#0a0922');
    this.vig = c.createRadialGradient(cx, H * 0.55, H * 0.3, cx, H * 0.55, H * 0.8);
    this.vig.addColorStop(0, 'rgba(0,0,10,0)'); this.vig.addColorStop(1, 'rgba(0,0,10,.6)');
    this.bvig = c.createRadialGradient(cx, H * 0.55, H * 0.25, cx, H * 0.55, H * 0.75);
    this.bvig.addColorStop(0, 'rgba(0,229,255,0)'); this.bvig.addColorStop(1, 'rgba(0,229,255,.5)');
  }

  draw(g, t) {
    const c = this.c, P = this.P, { W, H, hor, cx } = view, red = fxState.reduced;
    c.setTransform(this.sx, 0, 0, this.sy, 0, 0);
    if (g.shake > 0 && !red) c.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    c.drawImage(this.bg, 0, 0, W, H);
    const ox = (g.laneX - 1.5);
    for (const l of this.layers) c.drawImage(l.cv, -60 - ox * l.k, 0, W + 120, hor);
    c.fillStyle = this.fog; c.fillRect(0, hor - 40, W, 70);
    c.fillStyle = this.gnd; c.fillRect(0, hor, W, H - hor);

    // neon ground grid
    c.strokeStyle = '#ff2bd6'; c.lineWidth = 1.2;
    const gs = g.scroll % 10;
    for (let z = -gs; z < ZMAX; z += 10) {
      proj(0, z, P); c.globalAlpha = 0.4 * Math.min(1, (ZMAX - z) / 70);
      c.beginPath(); c.moveTo(0, P.y); c.lineTo(W, P.y); c.stroke();
    }
    c.globalAlpha = 0.18; c.beginPath();
    for (let i = -7; i <= 7; i++) { c.moveTo(cx, hor); c.lineTo(cx + i * 130, H); }
    c.stroke(); c.globalAlpha = 1;

    // road
    const sb = (H - hor) / (view.yp - hor), half = 2 * LW * sb;
    c.fillStyle = this.road; c.beginPath(); c.moveTo(cx, hor); c.lineTo(cx + half, H); c.lineTo(cx - half, H); c.closePath(); c.fill();
    c.lineCap = 'round';
    for (const e of [[-1, '#00e5ff'], [1, '#ff2bd6']]) {
      c.strokeStyle = e[1];
      c.globalAlpha = 0.25; c.lineWidth = 9; c.beginPath(); c.moveTo(cx + e[0] * half, H); c.lineTo(cx, hor); c.stroke();
      c.globalAlpha = 1; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx + e[0] * half, H); c.lineTo(cx, hor); c.stroke();
    }
    // lane dashes (one path)
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath();
    const ds = g.scroll % 12;
    for (let b = -1; b <= 1; b++) for (let z = -ds; z < ZMAX; z += 12) {
      const z1 = Math.max(z, -4), z2 = z + 5; if (z2 <= z1) continue;
      proj(1.5 + b, z1, P); const x1 = P.x, y1 = P.y, w1 = 1.8 * P.s;
      proj(1.5 + b, z2, P); const w2 = 1.8 * P.s;
      c.moveTo(x1 - w1, y1); c.lineTo(x1 + w1, y1); c.lineTo(P.x + w2, P.y); c.lineTo(P.x - w2, P.y);
    }
    c.fill();
    // roadside lamps
    const ps = g.scroll % 14;
    for (const side of [-1, 1]) for (let z = -ps; z < ZMAX; z += 14) {
      if (z < -3) continue;
      proj(1.5 + side * 2.6, z, P);
      c.globalAlpha = Math.min(1, (ZMAX - z) / 40);
      const col = side < 0 ? '#00e5ff' : '#ff2bd6', ph = 95 * P.s;
      c.strokeStyle = '#3b3f7a'; c.lineWidth = Math.max(1, 3 * P.s); c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(P.x, P.y - ph); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(P.x, P.y - ph, Math.max(1.2, 5 * P.s), 0, TAU); c.fill();
      c.globalAlpha *= 0.25; c.beginPath(); c.arc(P.x, P.y - ph, Math.max(2, 13 * P.s), 0, TAU); c.fill();
    }
    c.globalAlpha = 1;

    // objects, far to near
    const o = g.objects;
    for (let i = o.length - 1; i >= 0; i--) {
      const ob = o[i];
      if (ob.z > ZMAX || ob.z < -6 || ob.dead) continue;
      proj(ob.lane, ob.z, P);
      c.globalAlpha = Math.min(1, (ZMAX - ob.z) / 30);
      const w = LW * 0.78 * P.s;
      switch (ob.kind) {
        case 'car': drawCar(c, P.x, P.y, w * 0.92, ob.color, '#ffffff', { cabin: 0.55, wide: 0.92 }, 0, t); break;
        case 'truck': drawTruck(c, P.x, P.y, w * 1.05); break;
        case 'barrier': drawBarrier(c, P.x, P.y, w); break;
        default: drawPickup(c, P.x, P.y - (26 + Math.sin(t * 5 + ob.z) * 3) * P.s, 12 * P.s, t, ob.kind === 'shield');
      }
    }
    c.globalAlpha = 1;

    // player
    if (g.mode !== 'crashing' && g.mode !== 'over') {
      proj(g.laneX, 0, P);
      const v = g.veh, w = LW * 0.74, bob = g.mode === 'idle' ? Math.sin(t * 3) * 1.5 : 0;
      const tilt = Math.max(-0.2, Math.min(0.2, (g.lane - g.laneX) * 0.12));
      c.save(); c.translate(P.x, P.y + bob); c.rotate(tilt);
      drawCar(c, 0, 0, w, v.color, v.accent, v.style, g.bf, t);
      if (g.shield > 0 && (g.shield > 1.5 || Math.sin(t * 25) > 0)) {
        c.fillStyle = 'rgba(0,229,255,.16)'; c.strokeStyle = 'rgba(120,250,255,.9)'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(0, -w * 0.3, w * 0.75, w * 0.52, 0, 0, TAU); c.fill(); c.stroke();
      }
      c.restore();
    }
    g.fx.draw(c);

    // speed lines + screen effects
    const sn = Math.min(1, (g.vEff || 0) / (g.stats.vMax * 1.2));
    if (!red && (sn > 0.55 || g.bf > 0.1) && g.mode !== 'idle') {
      c.strokeStyle = g.bf > 0.1 ? 'rgba(160,250,255,.5)' : 'rgba(255,255,255,.22)'; c.lineWidth = 1.5; c.beginPath();
      const vy = hor + (view.yp - hor) * 0.25, R = Math.max(W, H), rate = 0.8 + sn * 1.4 + g.bf;
      for (const L of this.lines) {
        const p = (L.p + t * rate) % 1, r0 = 70 + p * p * R, r1 = r0 + 20 + p * 90 * (0.4 + sn);
        c.moveTo(cx + Math.cos(L.a) * r0, vy + Math.sin(L.a) * r0); c.lineTo(cx + Math.cos(L.a) * r1, vy + Math.sin(L.a) * r1);
      }
      c.stroke();
    }
    c.fillStyle = this.vig; c.fillRect(-20, -20, W + 40, H + 40);
    if (g.bf > 0.02 && !red) { c.globalAlpha = g.bf; c.fillStyle = this.bvig; c.fillRect(-20, -20, W + 40, H + 40); c.globalAlpha = 1; }
    if (g.flash > 0 && !red) { c.globalAlpha = Math.min(0.55, g.flash * 0.55); c.fillStyle = '#ff2a4d'; c.fillRect(-20, -20, W + 40, H + 40); c.globalAlpha = 1; }

    // popups
    c.textAlign = 'center'; c.font = `900 20px ${FONT}`;
    for (const p of g.popups) {
      if (p.life <= 0) continue;
      c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.c; c.fillText(p.t, p.x, p.y - (1 - p.life) * 45);
    }
    c.globalAlpha = 1;
    // countdown
    let txt = '';
    if (g.mode === 'countdown') txt = String(Math.ceil(g.cd)); else if (g.goT > 0) txt = 'GO!';
    if (txt) {
      const f = g.mode === 'countdown' ? (g.cd % 1) : g.goT;
      c.globalAlpha = Math.min(1, 0.4 + f); c.font = `900 ${txt === 'GO!' ? 96 : 120}px ${FONT}`;
      c.lineWidth = 6; c.strokeStyle = '#ff2bd6'; c.strokeText(txt, cx, H * 0.42); c.fillStyle = '#fff'; c.fillText(txt, cx, H * 0.42);
      c.globalAlpha = 1;
    }
  }
}
