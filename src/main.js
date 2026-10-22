// main.js - wires everything together: loop, screens, input, audio, settings.
import { state, save, resetAll } from './storage.js';
import { Renderer, fxState } from './renderer.js';
import { Game } from './game.js';
import { Input } from './input.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import { buy, select } from './garage.js';
import { claim } from './missions.js';

const app = document.getElementById('app');
const canvas = document.getElementById('game');
let renderer, game, input, last = 0, rafId = 0, resizeT = 0;

function applySettings() {
  fxState.q = state.settings.quality === 'low' ? 0.45 : 1;
  fxState.reduced = state.settings.reducedMotion;
  document.body.classList.toggle('reduce-motion', state.settings.reducedMotion);
  audio.applyVolume();
}

function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const r = Math.min(0.75, Math.max(0.46, vw / vh));
  const w = Math.floor(Math.min(vw, vh * r)), h = Math.floor(Math.min(vh, w / r));
  app.style.width = w + 'px'; app.style.height = h + 'px'; app.style.fontSize = (w / 390 * 15) + 'px';
  renderer.resize(w, h, state.settings.quality === 'low' ? 1 : 2);
}

// ----- game flow -----
function startRun() {
  audio.unlock(); audio.engineStart();
  game.begin(); ui.showScreen(null); ui.setHud(true);
}
function toMenu() {
  audio.engineStop(); game.toIdle(); ui.setHud(false); ui.renderMenu(); ui.showScreen('menu');
}
function pauseGame() {
  if (game.pause()) { audio.engineStop(); ui.showScreen('pause'); }
}
function resumeGame() {
  if (game.resume()) { audio.engineStart(); ui.showScreen(null); }
}
function onEscape() {
  const m = game.mode;
  if (m === 'playing') pauseGame();
  else if (m === 'paused') resumeGame();
  else if (['garage', 'missions', 'howto', 'settings'].some(s => document.getElementById('s-' + s).classList.contains('active'))) toMenu();
}

const events = {
  move: () => audio.sfx.move(),
  orb: c => audio.sfx.orb(c),
  shield: () => audio.sfx.shield(),
  shieldBreak: () => audio.sfx.shieldBreak(),
  boost: on => { if (on) audio.sfx.boost(); },
  crash: () => { audio.engineStop(); audio.sfx.crash(); },
  count: () => audio.sfx.count(),
  go: () => audio.sfx.go(),
  over: s => { audio.sfx.over(); ui.setHud(false); ui.showResults(s); }
};

const actions = {
  play() { audio.unlock(); audio.sfx.click(); if (!state.tutorialSeen) ui.showScreen('tutorial'); else startRun(); },
  tutorialGo() { state.tutorialSeen = true; save(); audio.sfx.click(); startRun(); },
  restart() { audio.sfx.click(); startRun(); },
  garage() { audio.unlock(); audio.sfx.click(); ui.renderGarage(); ui.showScreen('garage'); },
  missions() { audio.unlock(); audio.sfx.click(); ui.renderMissions(); ui.showScreen('missions'); },
  howto() { audio.unlock(); audio.sfx.click(); ui.showScreen('howto'); },
  settings() { audio.unlock(); audio.sfx.click(); ui.renderSettings(); ui.showScreen('settings'); },
  menu() { audio.sfx.click(); toMenu(); },
  pause() { pauseGame(); },
  resume() { audio.sfx.click(); resumeGame(); },
  'toggle-sound'() { audio.unlock(); state.settings.sound = !state.settings.sound; save(); applySettings(); audio.sfx.click(); ui.renderMenu(); },
  vehicle(d) {
    const owned = state.owned.includes(d.id);
    const r = owned ? select(d.id) : buy(d.id);
    if (r.ok) { owned ? audio.sfx.click() : audio.sfx.buy(); game.veh = null; game.reset(); game.lane = 1.5; } else audio.sfx.deny();
    ui.toast(r.msg, !r.ok); ui.renderGarage(); ui.renderMenu();
  },
  claim(d) {
    const r = claim(d.id);
    if (r.ok) { audio.sfx.claim(); ui.toast(`+${r.reward} credits - ${r.title} complete!`); } else audio.sfx.deny();
    ui.renderMissions(); ui.renderMenu();
  },
  'set-sound'() { audio.unlock(); state.settings.sound = !state.settings.sound; save(); applySettings(); audio.sfx.click(); ui.renderSettings(); ui.renderMenu(); },
  'set-motion'() { state.settings.reducedMotion = !state.settings.reducedMotion; save(); applySettings(); ui.renderSettings(); },
  quality(d) { state.settings.quality = d.q === 'low' ? 'low' : 'high'; save(); applySettings(); fit(); ui.renderSettings(); },
  volume(v) { state.settings.volume = Math.min(1, Math.max(0, v)); save(); audio.applyVolume(); },
  'reset-data'() {
    if (window.confirm('Erase all saved progress (credits, vehicles, missions, high score)?')) {
      resetAll(); applySettings(); ui.renderSettings(); ui.renderMenu(); ui.toast('Progress erased.');
    }
  }
};

function frame(now) {
  rafId = requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0.016;
  if (dt > 0.1) dt = 0.1;
  game.update(dt);
  renderer.draw(game, now / 1000);
  const m = game.mode;
  if (m === 'playing' || m === 'countdown' || m === 'crashing') ui.updateHud(game, dt);
  if (m === 'playing') audio.engineSet(game.speedNorm, game.boosting);
}

function showFatal(e) {
  console.error(e);
  if (window.nrFatal) window.nrFatal('Something went wrong while starting the game: ' + (e && e.message ? e.message : e));
}

function boot() {
  try {
    renderer = new Renderer(canvas);
    game = new Game(events);
    fit();
    applySettings();
    input = new Input({
      active: () => game.active,
      left: () => game.moveLane(-1),
      right: () => game.moveLane(1),
      boost: on => game.setBoost(on),
      pause: onEscape
    });
    input.attach();
    ui.init(actions);
    if (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
    ui.renderMenu();
    rafId = requestAnimationFrame(frame);
    window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(fit, 120); });
    window.addEventListener('orientationchange', () => { clearTimeout(resizeT); resizeT = setTimeout(fit, 300); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
    setTimeout(() => { ui.showScreen('menu'); }, 900);
    window.__neonrush = { game, state, actions };   // handy for debugging in the console
  } catch (e) { showFatal(e); }
}

boot();
