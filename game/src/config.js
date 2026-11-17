// Palmira Bay — every tuning number and colour in one place.
// The world is a fixed grid of streets and blocks; nothing below depends on the screen size.

export const WORLD = {
  /** Pixels across one city block (buildings sit inside these). */
  block: 360,
  /** Pixels across one street, kerb to kerb. */
  road: 120,
  /** Blocks per side. Streets run at every grid line, so there are GRID + 1 streets. */
  grid: 8,
  /** Width of the sidewalk strip along each street. */
  sidewalk: 18,
  /** Y where the sand starts; everything south of it is beach, then ocean. */
  beachY: 3960,
  /** Y where the ocean starts. */
  oceanY: 4140,
};

/** World width and height in pixels, derived from the grid above. */
export const WORLD_W = WORLD.grid * (WORLD.block + WORLD.road) + WORLD.road; // 3960
export const WORLD_H = WORLD.oceanY + 180; // 4320

/** Fixed seed: the same city, traffic and pedestrians every visit. */
export const WORLD_SEED = 20261117;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 265,
  accel: 2400,
  friction: 9,
  maxHealth: 100,
  enterRange: 80,
  punchDamage: 12,
};

export const CAR = {
  length: 64,
  width: 32,
  /** Engine force, pixels per second squared. */
  accel: 560,
  brake: 900,
  reverseAccel: 320,
  /** Top speed, pixels per second. */
  topSpeed: 620,
  reverseTop: 220,
  /** Steering, radians per second at full lock, scaled down with speed. */
  steer: 2.6,
  grip: 6.5,
  handbrakeGrip: 1.6,
  maxHealth: 100,
};

export const TRAFFIC = {
  count: 26,
  cruiseMin: 150,
  cruiseMax: 240,
  turnChance: 0.34,
  followGap: 84,
};

export const PEDS = {
  count: 42,
  walkMin: 42,
  walkMax: 78,
  fleeSpeed: 150,
};

export const POLICE = {
  /** Wanted stars, 0 to 5. */
  maxStars: 5,
  /** Seconds without a crime before the heat starts to cool. */
  coolDown: 12,
  /** Seconds between star drops while cooling and unseen. */
  coolTick: 8,
  /** How many police cars may hunt at once, by stars. */
  carsByStars: [0, 1, 2, 3, 4, 5],
  /** How many on-foot officers may hunt at once, by stars. */
  copsByStars: [0, 0, 1, 2, 3, 4],
  carTopSpeed: 660,
  copSpeed: 205,
  /** Seconds an officer must touch the player to bust them. */
  bustTime: 1.4,
  /** Distance at which an officer opens fire. */
  shootRange: 300,
};

export const COMBAT = {
  bulletSpeed: 950,
  bulletRange: 560,
  bulletDamage: 34,
  fireCooldown: 0.26,
  enemyDamage: 9,
  enemyCooldown: 0.7,
  carRamDamage: 26,
};

export const MISSIONS = [
  { name: 'First Wheels', reward: 150 },
  { name: 'The Pickup', reward: 300 },
  { name: 'Heat Rising', reward: 450 },
  { name: 'Three Stops', reward: 600 },
  { name: 'The Getaway', reward: 900 },
  { name: 'King of Palmira', reward: 1500 },
];

export const PALETTE = {
  asphalt: '#3a3f4a',
  asphaltDark: '#333743',
  roadLine: '#e8d44f',
  sidewalk: '#b8a88f',
  sidewalkEdge: '#9a8a72',
  sand: '#e9cf9a',
  sandDark: '#ddc186',
  ocean: '#2f7fa8',
  oceanDeep: '#256b8f',
  grass: '#7fae5a',
  grassDark: '#6f9c4c',
  buildingRoof: '#8a6f5c',
  player: '#ffd23f',
  playerCar: '#e63946',
  policeCar: '#2b4acb',
  policeLightRed: '#ff2d2d',
  policeLightBlue: '#2d7dff',
  text: '#f4efe4',
  muted: '#c9c2b2',
  hudPanel: 'rgba(12, 14, 20, 0.72)',
  hudBorder: 'rgba(244, 239, 228, 0.25)',
  star: '#ffd23f',
  starEmpty: 'rgba(244, 239, 228, 0.35)',
  health: '#3ddc74',
  healthLow: '#ff4747',
  cash: '#7dff9b',
  marker: '#ffd23f',
  danger: '#ff4747',
};

/** Sun-soaked building colours: terracotta, cream, teal, coral, sand, white, pink, mint. */
export const BUILDING_COLORS = [
  '#e07856', '#f2e3c6', '#4fa8a0', '#e88ca0', '#d9b380',
  '#f5f0e6', '#c96f8e', '#8fc7a3', '#e8a94f', '#7fa8c9',
  '#b08968', '#d97b6c', '#a3c585', '#e6c25a', '#9b7fb8',
];

/** Paint jobs for traffic cars. */
export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#ecf0f1', '#2c3e50', '#e67e22', '#16a085', '#d35400',
  '#7f8c8d', '#b03a2e', '#1f618d', '#943126', '#ca6f1e',
];

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Trebuchet MS", sans-serif';

/** Where the save lives in this browser only. */
export const SAVE_KEY = 'palmira-bay.save.v1';
