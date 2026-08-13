import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * SCAR-L. Slower and heavier than the M4 with a firmer push per shot, but the
 * climb is straight and short, so long bursts stay usable.
 */
export const SCAR: WeaponDefinition = {
  id: 'scar',
  name: 'SCAR-L',
  caliber: '5.56x45mm',
  fireModes: ['auto', 'semi'],
  rpm: 600,
  magazineSize: 30,
  reserveAmmo: 240,
  reloadTime: 2.5,
  equipTime: 0.52,
  recoil: {
    vertical: 0.03,
    horizontal: 0.011,
    climbPerShot: 0.05,
    maxClimb: 1.9,
    randomness: 0.24,
    snappiness: 30,
    recoverySpeed: 8.5,
    recoveryFraction: 0.68,
    kickback: 0.05,
    punch: 0.12,
    shake: 0.36,
  },
  spread: {
    base: 0.0026,
    adsMultiplier: 0.2,
    perShot: 0.0011,
    max: 0.02,
    recovery: 0.04,
    movePenalty: 0.007,
  },
  ads: { time: 0.26, fov: 58, sensitivityMultiplier: 0.68, recoilMultiplier: 0.76 },
  projectile: { velocity: 870, gravityMultiplier: 1, drag: 0.0011, maxDistance: 460, damage: 38 },
  movementMultiplier: 0.94,
  adsMovementMultiplier: 0.5,
  viewModel: {
    hipPosition: [0.17, -0.15, -0.38],
    hipRotation: [0.02, -0.06, 0.015],
    adsDistance: 0.34,
    swayAmount: 1.05,
    bobAmount: 1,
    weight: 26,
  },
  audio: {
    gain: 0.8,
    bodyFrequency: 84,
    crackFrequency: 1650,
    decay: 0.14,
    tailDecay: 0.46,
    mechanical: 0.6,
    reverb: 0.62,
  },
};
