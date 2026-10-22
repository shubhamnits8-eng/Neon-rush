// ui.js - screens, HUD, garage/missions/settings rendering, toasts and result animations.
import { state, isPersistent } from './storage.js';
import { VEHICLES, isOwned } from './garage.js';
import { MISSIONS, progress, progressValue, isDone, isClaimed, levelInfo, nearest } from './missions.js';
import { drawCarPreview } from './renderer.js';

const $ = id => document.getElementById(id);
const fmt = n => Math.floor(n).toLocaleString('en-US');
const SCREENS = ['loading', 'menu', 'garage', 'missions', 'howto', 'settings', 'tutorial', 'pause', 'over', 'error'];
let usingKeyboard = false, toastTimer = 0, countToken = 0, dispScore = 0;
const cache = {};

export function init(A) {
  window.addEventListener('keydown', () => { usingKeyboard = true; }, true);
  window.addEventListener('pointerdown', () => { usingKeyboard = false; }, true);
  $('app').addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const fn = A[b.dataset.action];
    if (fn) fn(b.dataset, b);
  });
  $('set-volume').addEventListener('input', e => { if (A.volume) A.volume(Number(e.target.value)); });
}

export function showScreen(name) {
  for (const id of SCREENS) { const e = $('s-' + id); if (e) { e.classList.toggle('active', id === name); e.inert = id !== name; } }
  if (name && usingKeyboard) {
    const f = $('s-' + name).querySelector('button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 60);
  }
}
export function setHud(on) {
  $('hud').classList.toggle('on', on);
  $('touch').classList.toggle('on', on);
  if (on) { dispScore = 0; for (const k in cache) delete cache[k]; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
}
export function showError(msg) { $('err-msg').textContent = msg; showScreen('error'); setHud(false); }

export function toast(msg, bad) {
  const t = $('toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 2200);
}

// ----- HUD -----
function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
export function updateHud(g, dt) {
  dispScore += (g.score - dispScore) * Math.min(1, dt * 10);
  setText('h-score', fmt(dispScore + 0.4));
  setText('h-best', fmt(Math.max(state.highScore, g.score)));
  setText('h-dist', fmt(g.distance));
  setText('h-speed', fmt((g.vEff || 0) * 3.6));
  setText('h-cred', fmt(g.credits));
  const b = Math.round(g.boost);
  if (cache.boost !== b) { cache.boost = b; $('h-boost').style.transform = `scaleX(${b / 100})`; $('h-boost').classList.toggle('low', b < 15); }
  const on = g.boosting; if (cache.bon !== on) { cache.bon = on; $('h-boost-wrap').classList.toggle('on', on); }
  const sh = g.shield > 0 ? Math.ceil(g.shield) : 0;
  if (cache.sh !== sh) { cache.sh = sh; $('h-shield').classList.toggle('on', sh > 0); $('h-shield-t').textContent = sh ? sh + 's' : ''; }
  const cm = g.combo > 0 ? 'x' + g.mult + ' · ' + g.combo : '';
  if (cache.cm !== cm) { cache.cm = cm; $('h-combo').classList.toggle('on', !!cm); $('h-combo').textContent = cm; }
}

// ----- Menu -----
export function renderMenu() {
  $('m-best').textContent = fmt(state.highScore);
  $('m-credits').textContent = fmt(state.credits);
  const L = levelInfo(state.xp);
  $('m-level').textContent = `LV ${L.level} · ${L.rank.toUpperCase()}`;
  $('m-xp').style.transform = `scaleX(${Math.max(0.02, L.pct)})`;
  const s = $('m-sound'); s.textContent = state.settings.sound ? '🔊' : '🔇'; s.setAttribute('aria-pressed', String(state.settings.sound));
}

// ----- Garage -----
const stat = (n, v) => `<div class="stat"><span>${n}</span><div class="bar"><i style="transform:scaleX(${v / 10})"></i></div></div>`;
export function renderGarage() {
  $('g-credits').textContent = fmt(state.credits);
  const box = $('g-list'); box.innerHTML = '';
  for (const v of VEHICLES) {
    const owned = isOwned(v.id), sel = state.selected === v.id;
    const card = document.createElement('article');
    card.className = 'card' + (sel ? ' sel' : '') + (owned ? '' : ' locked');
    card.innerHTML = `<canvas width="240" height="130" aria-label="${v.name} preview"></canvas>
      <div class="cinfo"><h3>${v.name}${owned ? '' : ' 🔒'}</h3>${stat('SPEED', v.speed)}${stat('HANDLING', v.handling)}${stat('BOOST', v.boost)}</div>
      <button class="btn ${owned ? (sel ? '' : 'primary') : 'buy'}" data-action="vehicle" data-id="${v.id}" ${sel ? 'disabled' : ''}>${sel ? '✓ SELECTED' : owned ? 'SELECT' : 'BUY · ' + fmt(v.price)}</button>`;
    box.appendChild(card);
    drawCarPreview(card.querySelector('canvas'), v);
  }
}

// ----- Missions -----
export function renderMissions() {
  const L = levelInfo(state.xp);
  $('mi-level').textContent = `LV ${L.level} · ${L.rank.toUpperCase()}`;
  $('mi-xp').style.transform = `scaleX(${Math.max(0.02, L.pct)})`;
  $('mi-next').textContent = `${fmt(L.toNext)} XP to next level`;
  const box = $('mi-list'); box.innerHTML = '';
  for (const m of MISSIONS) {
    const done = isDone(m), cl = isClaimed(m);
    const el = document.createElement('div'); el.className = 'mission' + (cl ? ' claimed' : done ? ' ready' : '');
    el.innerHTML = `<div class="mtxt"><h3>${m.title}</h3><p>${m.desc}</p>
      <div class="bar"><i style="transform:scaleX(${Math.max(0.01, progress(m))})"></i></div>
      <small>${fmt(progressValue(m))} / ${fmt(m.target)} · reward ₡${m.reward}</small></div>
      <button class="btn ${done && !cl ? 'primary' : ''}" data-action="claim" data-id="${m.id}" ${done && !cl ? '' : 'disabled'}>${cl ? 'CLAIMED ✓' : done ? 'CLAIM' : 'IN PROGRESS'}</button>`;
    box.appendChild(el);
  }
}

// ----- Settings -----
export function renderSettings() {
  const s = state.settings;
  const set = (id, on) => { const b = $(id); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'ON' : 'OFF'; };
  set('set-sound', s.sound); set('set-motion', s.reducedMotion);
  $('set-volume').value = s.volume;
  $('q-high').setAttribute('aria-pressed', String(s.quality === 'high'));
  $('q-low').setAttribute('aria-pressed', String(s.quality === 'low'));
  $('save-note').textContent = isPersistent()
    ? 'Your progress is saved in this browser (LocalStorage) on this device only.'
    : 'LocalStorage is unavailable (private mode?). You can play, but progress will not be saved.';
}

// ----- Results -----
export function showResults(s) {
  const t = $('o-title'); t.textContent = s.newBest ? 'NEW PERSONAL BEST!' : 'CRASHED'; t.classList.toggle('gold', s.newBest);
  countToken++;
  const tok = countToken; // count() increments again per element, so run them sequentially-safe
  const els = [['o-score', s.score], ['o-dist', s.distance], ['o-orbs', s.orbs], ['o-cred', s.credits]];
  els.forEach(([id, v]) => { $(id).textContent = '0'; });
  // simple parallel count-up with one shared token
  const t0 = performance.now(), dur = state.settings.reducedMotion ? 0 : 900;
  const f = now => {
    if (tok !== countToken) return;
    const p = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - p, 3);
    els.forEach(([id, v]) => { $(id).textContent = fmt(v * e); });
    if (p < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  const note = $('o-note');
  note.textContent = s.leveledUp ? `⬆ LEVEL UP! You are now ${levelInfo(state.xp).rank}.` : `+${fmt(s.xpGain)} XP`;
  const done = s.completed.map(m => m.title);
  $('o-missions').innerHTML = (done.length ? `<div class="done">✔ Mission complete: ${done.join(', ')} - claim it in Missions!</div>` : '') +
    nearest(3).map(m => `<div class="mrow"><span>${m.title}</span><div class="bar"><i style="transform:scaleX(${Math.max(0.01, progress(m))})"></i></div><small>${Math.round(progress(m) * 100)}%</small></div>`).join('');
  showScreen('over');
}
