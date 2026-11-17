// Save and load, in this browser only (localStorage). The save holds the
// player's cash, which missions are done, and lifetime stats — never a secret.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    cash: 0,
    missionsDone: 0,
    carsStolen: 0,
    bustedCount: 0,
    wastedCount: 0,
    playSeconds: 0,
    bestWanted: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
    return { ...defaultSave(), ...parsed };
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable (private mode): the game still plays.
  }
}
