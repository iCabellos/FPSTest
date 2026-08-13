import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * .357 Magnum revolver. Six rounds, no magazine and no spare speed: it is
 * refilled a cylinder at a time, so every shot has to be worth taking.
 */
export const REVOLVER: WeaponDefinition = {
  id: 'revolver',
  name: 'MAGNUM',
  caliber: '.357 Magnum',
  fireModes: ['semi'],
  rpm: 200,
  magazineSize: 6,
  reserveAmmo: 48,
  reloadTime: 3.1,
  equipTime: 0.42,
  reloadStyle: 'internal',
  recoil: {
    vertical: 0.062,
    horizontal: 0.016,
    climbPerShot: 0.05,
    maxClimb: 1.7,
    randomness: 0.3,
    snappiness: 28,
    recoverySpeed: 6.2,
    recoveryFraction: 0.7,
    kickback: 0.1,
    punch: 0.25,
    shake: 0.62,
  },
  spread: {
    base: 0.0024,
    adsMultiplier: 0.18,
    perShot: 0.0022,
    max: 0.015,
    recovery: 0.026,
    movePenalty: 0.006,
  },
  ads: { time: 0.22, fov: 59, sensitivityMultiplier: 0.66, recoilMultiplier: 0.84 },
  projectile: { velocity: 440, gravityMultiplier: 1, drag: 0.002, maxDistance: 240, damage: 82 },
  movementMultiplier: 1.05,
  adsMovementMultiplier: 0.6,
  viewModel: {
    hipPosition: [0.155, -0.145, -0.3],
    hipRotation: [0.02, -0.07, 0.018],
    adsDistance: 0.3,
    swayAmount: 1.05,
    bobAmount: 0.96,
    weight: 20,
  },
  audio: {
    gain: 0.88,
    bodyFrequency: 74,
    crackFrequency: 1360,
    decay: 0.19,
    tailDecay: 0.58,
    mechanical: 0.5,
    reverb: 0.74,
  },
};
