// garage.js - vehicle catalogue, buying and selecting. All vehicles are original designs.
import { state, save } from './storage.js';

export const VEHICLES = [
  { id: 'pulse',   name: 'Pulse GT',     price: 0,    speed: 5, handling: 5, boost: 5, color: '#00e5ff', accent: '#ffffff', style: { cabin: 0.58, stripe: true } },
  { id: 'vortex',  name: 'Vortex R',     price: 300,  speed: 6, handling: 8, boost: 5, color: '#ff2bd6', accent: '#ffe0f9', style: { cabin: 0.5, spoiler: 1, wide: 0.98 } },
  { id: 'phantom', name: 'Phantom X',    price: 800,  speed: 7, handling: 6, boost: 8, color: '#8b5cff', accent: '#d9ccff', style: { cabin: 0.62, cabinH: 0.28, bar: true, stripe: true } },
  { id: 'ember',   name: 'Ember Strike', price: 1600, speed: 9, handling: 6, boost: 8, color: '#ff7a1a', accent: '#fff2c4', style: { cabin: 0.46, cabinH: 0.3, spoiler: 1, wide: 1, stripe: true } },
  { id: 'aurora',  name: 'Aurora Zero',  price: 3200, speed: 10, handling: 9, boost: 10, color: '#38ff9c', accent: '#0b1030', style: { cabin: 0.5, cabinH: 0.26, spoiler: 1, bar: true, wide: 1 } }
];

export const getVehicle = id => VEHICLES.find(v => v.id === id) || VEHICLES[0];
export const selectedVehicle = () => getVehicle(state.selected);
export const isOwned = id => state.owned.includes(id);

export function buy(id) {
  const v = VEHICLES.find(x => x.id === id);
  if (!v) return { ok: false, msg: 'Unknown vehicle.' };
  if (isOwned(id)) return { ok: false, msg: 'You already own this vehicle.' };
  if (state.credits < v.price) return { ok: false, msg: `Not enough credits - you need ${v.price - state.credits} more.` };
  state.credits -= v.price;
  state.owned.push(id);
  state.selected = id;
  save();
  return { ok: true, msg: `${v.name} unlocked and selected!` };
}

export function select(id) {
  const v = VEHICLES.find(x => x.id === id);
  if (!v || !isOwned(id)) return { ok: false, msg: 'Vehicle is locked.' };
  state.selected = id;
  save();
  return { ok: true, msg: `${v.name} selected.` };
}
