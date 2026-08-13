import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * Roller delayed 9 mm: the flattest shooting weapon on the range. Fast
 * cadence with very little climb, paid for with a slow, arcing bullet.
 */
export const MP5: WeaponDefinition = {
  id: 'mp5',
  name: 'MP5',
  caliber: '9 x 19',
  fireModes: ['auto', 'semi'],
  rpm: 800,
  magazineSize: 30,
  reserveAmmo: 240,
  reloadTime: 2.6,
  equipTime: 0.5,
  recoil: {
    vertical: 0.018,
    horizontal: 0.0085,
    climbPerShot: 0.055,
    maxClimb: 1.8,
    randomness: 0.3,
    snappiness: 34,
    recoverySpeed: 7,
    recoveryFraction: 0.74,
    kickback: 0.04,
    punch: 0.085,
    shake: 0.24,
  },
  spread: {
    base: 0.0024,
    adsMultiplier: 0.28,
    perShot: 0.001,
    max: 0.012,
    recovery: 0.02,
    movePenalty: 0.0045,
  },
  ads: {
    time: 0.19,
    fov: 60,
    sensitivityMultiplier: 0.7,
    recoilMultiplier: 0.78,
  },
  projectile: {
    velocity: 400,
    gravityMultiplier: 1,
    drag: 0.0016,
    maxDistance: 260,
    damage: 24,
  },
  movementMultiplier: 1.06,
  adsMovementMultiplier: 0.58,
  viewModel: {
    hipPosition: [0.16, -0.15, -0.33],
    hipRotation: [0.02, -0.06, 0.015],
    adsDistance: 0.3,
    swayAmount: 0.9,
    bobAmount: 0.95,
    weight: 20,
  },
  audio: {
    gain: 0.52,
    bodyFrequency: 118,
    crackFrequency: 2100,
    decay: 0.11,
    tailDecay: 0.3,
    mechanical: 0.85,
  },
};
