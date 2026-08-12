import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * High capacity 9 mm sidearm. Seventeen rounds and a fast, flat recovery, at
 * the cost of the lightest hit on the roster.
 */
export const M9: WeaponDefinition = {
  id: 'm9',
  name: 'M9',
  caliber: '9 x 19',
  fireModes: ['semi'],
  rpm: 450,
  magazineSize: 17,
  reloadTime: 2.1,
  equipTime: 0.35,
  recoil: {
    vertical: 0.024,
    horizontal: 0.009,
    climbPerShot: 0.04,
    maxClimb: 1.6,
    randomness: 0.3,
    snappiness: 34,
    recoverySpeed: 8.5,
    recoveryFraction: 0.8,
    kickback: 0.05,
    punch: 0.11,
    shake: 0.28,
  },
  spread: {
    base: 0.0026,
    adsMultiplier: 0.24,
    perShot: 0.0012,
    max: 0.012,
    recovery: 0.024,
    movePenalty: 0.005,
  },
  ads: {
    time: 0.16,
    fov: 62,
    sensitivityMultiplier: 0.72,
    recoilMultiplier: 0.8,
  },
  projectile: {
    velocity: 380,
    gravityMultiplier: 1,
    drag: 0.0017,
    maxDistance: 220,
    damage: 26,
  },
  movementMultiplier: 1.12,
  adsMovementMultiplier: 0.68,
  viewModel: {
    hipPosition: [0.15, -0.14, -0.29],
    hipRotation: [0.02, -0.07, 0.015],
    adsDistance: 0.28,
    swayAmount: 0.85,
    bobAmount: 0.9,
    weight: 24,
  },
  audio: {
    gain: 0.5,
    bodyFrequency: 124,
    crackFrequency: 2250,
    decay: 0.1,
    tailDecay: 0.28,
    mechanical: 0.7,
    reverb: 0.38,
  },
};
