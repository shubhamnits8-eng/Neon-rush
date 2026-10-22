// audio.js - synthesized sound effects (Web Audio API). Nothing plays until unlock() is called from a user gesture.
import { state } from './storage.js';

let ctx = null, master = null, noiseBuf = null, eng = null, lastSet = 0;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolume();
    } catch (e) { ctx = null; return; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function applyVolume() {
  if (master) master.gain.value = state.settings.sound ? state.settings.volume : 0;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
  if (!ctx || !state.settings.sound) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise(dur, vol, freq) {
  if (!ctx || !state.settings.sound) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.03);
}

export const sfx = {
  click() { tone(720, 0.06, 'square', 0.07); },
  move() { tone(300, 0.07, 'triangle', 0.06, 450); },
  orb(combo = 1) { tone(660 + Math.min(combo, 12) * 40, 0.12, 'sine', 0.16, 1320); },
  shield() { tone(440, 0.25, 'triangle', 0.18, 880); tone(660, 0.25, 'sine', 0.12, 1320, 0.08); },
  shieldBreak() { noise(0.25, 0.25, 2500); tone(500, 0.2, 'sawtooth', 0.12, 120); },
  boost() { tone(180, 0.5, 'sawtooth', 0.14, 900); noise(0.5, 0.1, 4000); },
  crash() { noise(0.8, 0.5, 3000); tone(140, 0.6, 'sawtooth', 0.25, 40); },
  over() { tone(330, 0.3, 'triangle', 0.15, 0, 0.1); tone(247, 0.3, 'triangle', 0.15, 0, 0.35); tone(165, 0.6, 'triangle', 0.18, 0, 0.6); },
  count() { tone(520, 0.1, 'square', 0.09); },
  go() { tone(880, 0.35, 'square', 0.1, 1320); },
  buy() { tone(523, 0.1, 'triangle', 0.15); tone(784, 0.2, 'triangle', 0.15, 0, 0.1); },
  deny() { tone(180, 0.18, 'square', 0.1, 120); },
  claim() { tone(523, 0.1, 'sine', 0.15); tone(659, 0.1, 'sine', 0.15, 0, 0.1); tone(988, 0.25, 'sine', 0.15, 0, 0.2); }
};

export function engineStart() {
  if (!ctx || eng) return;
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0.0001;
  o.connect(f); f.connect(g); g.connect(master); o.start();
  eng = { o, g, f };
}

export function engineSet(n, boosting) {
  if (!eng || !ctx) return;
  const now = performance.now();
  if (now - lastSet < 80) return;
  lastSet = now;
  const t = ctx.currentTime;
  eng.o.frequency.setTargetAtTime(55 + n * 95 + (boosting ? 30 : 0), t, 0.08);
  eng.g.gain.setTargetAtTime(state.settings.sound ? 0.04 + n * 0.03 : 0.0001, t, 0.1);
  eng.f.frequency.setTargetAtTime(300 + n * 700, t, 0.1);
}

export function engineStop() {
  if (!eng || !ctx) return;
  const e = eng; eng = null;
  try { e.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); } catch (err) { /* ignore */ }
  setTimeout(() => { try { e.o.stop(); } catch (err) { /* ignore */ } }, 300);
}
