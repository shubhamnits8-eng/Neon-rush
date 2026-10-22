// missions.js - missions, rewards, run recording and reputation level.
import { state, save } from './storage.js';

export const MISSIONS = [
  { id: 'd1', title: 'Warm-Up Run',    desc: 'Travel 1,000 m in one run',      type: 'distance', target: 1000,  reward: 100 },
  { id: 'o1', title: 'Orb Hunter',     desc: 'Collect 15 orbs in one run',     type: 'orbs',     target: 15,    reward: 100 },
  { id: 't1', title: 'Survivor',       desc: 'Survive 45 seconds',             type: 'time',     target: 45,    reward: 150 },
  { id: 's1', title: 'Score Chaser',   desc: 'Reach 3,000 score in one run',   type: 'score',    target: 3000,  reward: 200 },
  { id: 'd2', title: 'Long Haul',      desc: 'Travel 3,500 m in one run',      type: 'distance', target: 3500,  reward: 300 },
  { id: 'o2', title: 'Energy Hoarder', desc: 'Collect 40 orbs in one run',     type: 'orbs',     target: 40,    reward: 250 },
  { id: 't2', title: 'Night Owl',      desc: 'Survive 120 seconds',            type: 'time',     target: 120,   reward: 300 },
  { id: 's2', title: 'Neon Legend',    desc: 'Reach 12,000 score in one run',  type: 'score',    target: 12000, reward: 450 }
];

const RANKS = ['Rookie', 'Street Racer', 'Neon Runner', 'Night Drifter', 'Cyber Ace', 'Velocity Legend'];

export const progressValue = m => Math.min(m.target, state.best[m.type] || 0);
export const progress = m => progressValue(m) / m.target;
export const isDone = m => (state.best[m.type] || 0) >= m.target;
export const isClaimed = m => state.missions[m.id] === 'claimed';

export function claim(id) {
  const m = MISSIONS.find(x => x.id === id);
  if (!m || !isDone(m) || isClaimed(m)) return { ok: false, reward: 0 };
  state.missions[id] = 'claimed';   // one-time reward: can never be claimed twice
  state.credits += m.reward;
  save();
  return { ok: true, reward: m.reward, title: m.title };
}

export function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const base = 40 * (level - 1) ** 2, next = 40 * level ** 2;
  return { level, pct: (xp - base) / (next - base), toNext: next - xp, rank: RANKS[Math.min(RANKS.length - 1, level - 1)] };
}

// Called once at the end of every run. run = {score, distance, orbs, time, credits}
export function recordRun(run) {
  const before = MISSIONS.filter(isDone).map(m => m.id);
  const lvlBefore = levelInfo(state.xp).level;
  const newBest = run.score > state.highScore;
  if (newBest) state.highScore = run.score;
  for (const k of ['distance', 'orbs', 'time', 'score']) state.best[k] = Math.max(state.best[k] || 0, run[k] || 0);
  state.credits += run.credits;
  const xpGain = Math.round(run.score / 25 + run.orbs);
  state.xp += xpGain;
  save();
  return {
    newBest, xpGain,
    completed: MISSIONS.filter(m => isDone(m) && !before.includes(m.id)),
    leveledUp: levelInfo(state.xp).level > lvlBefore
  };
}

// Unclaimed missions, closest to completion first
export function nearest(n) {
  return MISSIONS.filter(m => !isClaimed(m)).sort((a, b) => progress(b) - progress(a)).slice(0, n);
}
