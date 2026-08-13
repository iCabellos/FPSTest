import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * SPAS-12. Semi automatic, so it puts shells out far faster than the 870, but
 * it holds fewer, kicks harder and spreads wider. Still loaded one at a time.
 */
export const SPAS12: WeaponDefinition = {
  id: 'spas12',
  name: 'SPAS-12',
  caliber: '12 gauge',
  fireModes: ['semi'],
  rpm: 240,
  magazineSize: 6,
  reserveAmmo: 42,
  reloadTime: 0.7,
  equipTime: 0.54,
  reloadStyle: 'shells',
  recoil: {
    vertical: 0.082,
    horizontal: 0.019,
    climbPerShot: 0.05,
    maxClimb: 1.8,
    randomness: 0.34,
    snappiness: 22,
    recoverySpeed: 5,
    recoveryFraction: 0.66,
    kickback: 0.125,
    punch: 0.3,
    shake: 0.85,
  },
  spread: {
    base: 0.016,
    adsMultiplier: 0.72,
    perShot: 0.003,
    max: 0.034,
    recovery: 0.042,
    movePenalty: 0.007,
  },
  ads: { time: 0.3, fov: 64, sensitivityMultiplier: 0.74, recoilMultiplier: 0.92 },
  projectile: {
    velocity: 380,
    gravityMultiplier: 1,
    drag: 0.0065,
    maxDistance: 200,
    damage: 24,
    pellets: 9,
  },
  movementMultiplier: 0.9,
  adsMovementMultiplier: 0.5,
  viewModel: {
    hipPosition: [0.175, -0.155, -0.36],
    hipRotation: [0.02, -0.06, 0.018],
    adsDistance: 0.33,
    swayAmount: 1.25,
    bobAmount: 1.1,
    weight: 30,
  },
  audio: {
    gain: 1,
    bodyFrequency: 54,
    crackFrequency: 900,
    decay: 0.24,
    tailDecay: 0.72,
    mechanical: 0.78,
  },
};
