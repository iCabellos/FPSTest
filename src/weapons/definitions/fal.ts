import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * FN FAL. A 7.62 battle rifle: twenty rounds that hit far harder than any
 * 5.56 here, and a climb that punishes anything longer than a short burst.
 */
export const FAL: WeaponDefinition = {
  id: 'fal',
  name: 'FN FAL',
  caliber: '7.62x51mm',
  fireModes: ['semi', 'auto'],
  rpm: 650,
  magazineSize: 20,
  reserveAmmo: 160,
  reloadTime: 2.7,
  equipTime: 0.58,
  recoil: {
    vertical: 0.05,
    horizontal: 0.017,
    climbPerShot: 0.075,
    maxClimb: 2.3,
    randomness: 0.3,
    snappiness: 26,
    recoverySpeed: 6.5,
    recoveryFraction: 0.6,
    kickback: 0.08,
    punch: 0.19,
    shake: 0.54,
  },
  spread: {
    base: 0.003,
    adsMultiplier: 0.2,
    perShot: 0.0019,
    max: 0.026,
    recovery: 0.036,
    movePenalty: 0.008,
  },
  ads: { time: 0.3, fov: 57, sensitivityMultiplier: 0.64, recoilMultiplier: 0.8 },
  projectile: { velocity: 840, gravityMultiplier: 1, drag: 0.001, maxDistance: 520, damage: 58 },
  movementMultiplier: 0.88,
  adsMovementMultiplier: 0.46,
  viewModel: {
    hipPosition: [0.175, -0.155, -0.4],
    hipRotation: [0.02, -0.055, 0.015],
    adsDistance: 0.35,
    swayAmount: 1.2,
    bobAmount: 1.08,
    weight: 30,
  },
  audio: {
    gain: 0.92,
    bodyFrequency: 70,
    crackFrequency: 1420,
    decay: 0.17,
    tailDecay: 0.56,
    mechanical: 0.58,
  },
};
