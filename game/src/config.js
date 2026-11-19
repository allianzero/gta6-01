// Palmira Bay — shared tuning constants for the open-world crime game.
// Original city, story and names. Nothing here comes from any commercial game.
export const GAME_TITLE = 'PALMIRA BAY';
export const GAME_SUBTITLE = 'Sun, sand and trouble on the Coral Coast';
export const WORLD_SEED = 1337;
export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const ROAD = 96;
export const BLOCK = 320;
export const STEP = ROAD + BLOCK;
export const FIXED_DT = 1 / 60;
export const SAVE_KEY = 'palmira-bay-save-v1';

export const DISTRICTS = [
  { name: 'Old Harbor', x: 0, y: 0, w: 1200, h: 900, tint: '#3d6b8e' },
  { name: 'Neon Strip', x: 1200, y: 0, w: 1200, h: 900, tint: '#8e3d7a' },
  { name: 'Palm Heights', x: 2400, y: 0, w: 1200, h: 900, tint: '#3d8e5a' },
  { name: 'Marina West', x: 0, y: 900, w: 1200, h: 1000, tint: '#3d7a8e' },
  { name: 'Downtown', x: 1200, y: 900, w: 1200, h: 1000, tint: '#8e7a3d' },
  { name: 'Coral Beach', x: 2400, y: 900, w: 1200, h: 1000, tint: '#c2a35a' },
  { name: 'South Docks', x: 0, y: 1900, w: 1200, h: 900, tint: '#5a5a6b' },
  { name: 'Little Havana Bay', x: 1200, y: 1900, w: 1200, h: 900, tint: '#8e5a3d' },
  { name: 'Sunset Fields', x: 2400, y: 1900, w: 1200, h: 900, tint: '#6b8e3d' },
];

export const CAR_DEFS = [
  { id: 'sedan', name: 'Coral Sedan', color: '#c94f42', speed: 300, accel: 210, grip: 3.2, w: 46, h: 22 },
  { id: 'taxi', name: 'Bay Taxi', color: '#e8b93c', speed: 280, accel: 200, grip: 3.0, w: 46, h: 22 },
  { id: 'sport', name: 'Vortex GT', color: '#3c7ae8', speed: 400, accel: 290, grip: 3.8, w: 48, h: 21 },
  { id: 'truck', name: 'Hauler Van', color: '#7a7a82', speed: 230, accel: 150, grip: 2.6, w: 56, h: 24 },
  { id: 'cop', name: 'PBPD Cruiser', color: '#22283a', speed: 360, accel: 260, grip: 3.6, w: 47, h: 22 },
  { id: 'muscle', name: 'Sunset Muscle', color: '#7a3ce8', speed: 350, accel: 250, grip: 3.3, w: 48, h: 22 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 12, range: 34, rate: 0.35, ammo: -1 },
  { id: 'pistol', name: 'P9 Pistol', damage: 26, range: 320, rate: 0.28, ammo: 12 },
  { id: 'smg', name: 'Stinger SMG', damage: 14, range: 280, rate: 0.09, ammo: 30 },
];

export const WANTED_DECAY = 14;
export const MAX_WANTED = 5;
export const COP_RESPAWN = 2.2;

export const PLAYER_START = { x: 1450, y: 1250, angle: -Math.PI / 2 };
export const DAY_LENGTH = 240;
