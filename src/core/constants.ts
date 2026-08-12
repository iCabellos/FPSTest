/** Shared tuning values. Anything a designer might want to tweak lives here. */

export const GRAVITY = 9.81;

export const PLAYER = {
  eyeHeight: 1.68,
  radius: 0.35,
  walkSpeed: 4.2,
  acceleration: 55,
  friction: 12,
  /** Half-extents of the walkable area around the firing line. */
  bounds: { minX: -8.6, maxX: 8.6, minZ: 1.15, maxZ: 7.6 },
  bobFrequency: 9.5,
  bobAmplitude: 0.035,
} as const;

export const CAMERA = {
  baseFov: 75,
  near: 0.08,
  far: 700,
  maxPitch: Math.PI / 2 - 0.02,
  /** Radians of yaw per pixel of mouse movement at sensitivity 1. */
  lookSpeed: 0.0022,
  fovSmoothing: 14,
} as const;

/** Separate pass for the first person weapon, so it never clips into geometry. */
export const VIEWMODEL_CAMERA = {
  fov: 58,
  near: 0.01,
  far: 8,
} as const;

export const RANGE = {
  laneCenters: [-6, -2, 2, 6],
  targetDistances: [25, 50, 100, 200],
  /** Plate radius per distance, enlarged with range so far targets stay readable. */
  targetRadii: [0.3, 0.42, 0.65, 1.0],
  wallHeight: 3.2,
  backstopDistance: 215,
} as const;

export const LIMITS = {
  projectiles: 96,
  tracers: 96,
  decals: 96,
  targetDecals: 10,
  casings: 40,
  sparks: 192,
  smokePuffs: 12,
} as const;

export const RENDER = {
  maxPixelRatio: 2,
  shadowMapSize: 2048,
  fogDensity: 0.0021,
} as const;

export const MAX_DELTA = 1 / 20;
