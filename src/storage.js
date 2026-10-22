// storage.js - safe LocalStorage wrapper. Works even if storage is blocked or corrupted.
const KEY = 'neonrush.save.v1';

function prefersReduced() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

const defaults = () => ({
  highScore: 0, credits: 0, xp: 0,
  owned: ['pulse'], selected: 'pulse',
  missions: {},
  best: { distance: 0, orbs: 0, time: 0, score: 0 },
  tutorialSeen: false,
  settings: { sound: true, volume: 0.7, quality: 'high', reducedMotion: prefersReduced() }
});

function getStore() {
  try { const s = window.localStorage; s.setItem('__nr', '1'); s.removeItem('__nr'); return s; } catch (e) { return null; }
}
const store = getStore();
const num = (v, d, lo = 0, hi = Infinity) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

function readRaw() {
  if (!store) return null;
  try { return JSON.parse(store.getItem(KEY)); } catch (e) { return null; }
}

function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  d.highScore = Math.floor(num(raw.highScore, 0));
  d.credits = Math.floor(num(raw.credits, 0));
  d.xp = Math.floor(num(raw.xp, 0));
  if (Array.isArray(raw.owned)) d.owned = Array.from(new Set(['pulse', ...raw.owned.filter(x => typeof x === 'string')]));
  if (typeof raw.selected === 'string' && d.owned.includes(raw.selected)) d.selected = raw.selected;
  if (raw.missions && typeof raw.missions === 'object') {
    for (const k of Object.keys(raw.missions)) if (raw.missions[k] === 'claimed') d.missions[k] = 'claimed';
  }
  if (raw.best && typeof raw.best === 'object') for (const k of Object.keys(d.best)) d.best[k] = num(raw.best[k], 0);
  d.tutorialSeen = raw.tutorialSeen === true;
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  d.settings.sound = s.sound !== false;
  d.settings.volume = num(s.volume, 0.7, 0, 1);
  d.settings.quality = s.quality === 'low' ? 'low' : 'high';
  if (typeof s.reducedMotion === 'boolean') d.settings.reducedMotion = s.reducedMotion;
  return d;
}

export const state = sanitize(readRaw());
export const isPersistent = () => !!store;

export function save() {
  if (!store) return false;
  try { store.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
}

export function resetAll() {
  const keepSettings = state.settings;
  Object.assign(state, defaults());
  state.settings = keepSettings;
  save();
}
