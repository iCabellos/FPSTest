import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * Uzi. Very fast, very short, and it wanders: a bullet hose for corridors that
 * loses interest in anything past about fifty metres.
 */
export const UZI: WeaponDefinition = {
  id: 'uzi',
  name: 'UZI',
  caliber: '9x19mm',
  fireModes: ['auto', 'semi'],
  rpm: 600,
  magazineSize: 32,
  reserveAmmo: 256,
  reloadTime: 2.4,
  equipTime: 0.38,
  recoil: {
    vertical: 0.02,
    horizontal: 0.016,
    climbPerShot: 0.05,
    maxClimb: 2.4,
    randomness: 0.42,
    snappiness: 36,
    recoverySpeed: 10,
    recoveryFraction: 0.74,
    kickback: 0.03,
    punch: 0.075,
    shake: 0.24,
  },
  spread: {
    base: 0.0058,
    adsMultiplier: 0.42,
    perShot: 0.0013,
    max: 0.03,
    recovery: 0.052,
    movePenalty: 0.009,
  },
  ads: { time: 0.19, fov: 65, sensitivityMultiplier: 0.8, recoilMultiplier: 0.9 },
  projectile: { velocity: 360, gravityMultiplier: 1, drag: 0.0026, maxDistance: 200, damage: 24 },
  movementMultiplier: 1.06,
  adsMovementMultiplier: 0.7,
  viewModel: {
    hipPosition: [0.16, -0.14, -0.34],
    hipRotation: [0.02, -0.06, 0.015],
    adsDistance: 0.3,
    swayAmount: 0.95,
    bobAmount: 0.95,
    weight: 24,
  },
  audio: {
    gain: 0.6,
    bodyFrequency: 108,
    crackFrequency: 1910,
    decay: 0.1,
    tailDecay: 0.3,
    mechanical: 0.82,
    reverb: 0.42,
  },
};
