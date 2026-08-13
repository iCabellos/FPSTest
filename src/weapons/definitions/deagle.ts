import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * Desert Eagle .50 AE. Seven rounds that hit like a rifle, out of a pistol
 * that fights you for every one of them: the muzzle climbs hard and the
 * magazine is gone in a heartbeat.
 */
export const DEAGLE: WeaponDefinition = {
  id: 'deagle',
  name: 'DESERT EAGLE',
  caliber: '.50 AE',
  fireModes: ['semi'],
  rpm: 260,
  magazineSize: 7,
  reserveAmmo: 42,
  reloadTime: 2.6,
  equipTime: 0.46,
  recoil: {
    vertical: 0.072,
    horizontal: 0.02,
    climbPerShot: 0.06,
    maxClimb: 1.8,
    randomness: 0.34,
    snappiness: 26,
    recoverySpeed: 5.5,
    recoveryFraction: 0.66,
    kickback: 0.12,
    punch: 0.29,
    shake: 0.72,
  },
  spread: {
    base: 0.0032,
    adsMultiplier: 0.2,
    perShot: 0.0028,
    max: 0.018,
    recovery: 0.028,
    movePenalty: 0.007,
  },
  ads: { time: 0.24, fov: 60, sensitivityMultiplier: 0.66, recoilMultiplier: 0.86 },
  projectile: { velocity: 470, gravityMultiplier: 1, drag: 0.0019, maxDistance: 260, damage: 96 },
  movementMultiplier: 1.02,
  adsMovementMultiplier: 0.58,
  viewModel: {
    hipPosition: [0.16, -0.15, -0.32],
    hipRotation: [0.02, -0.07, 0.02],
    adsDistance: 0.31,
    swayAmount: 1.15,
    bobAmount: 1,
    weight: 19,
  },
  audio: {
    gain: 0.95,
    bodyFrequency: 64,
    crackFrequency: 1180,
    decay: 0.2,
    tailDecay: 0.62,
    mechanical: 0.6,
  },
};
