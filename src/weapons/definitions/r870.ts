import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * Remington 870. Pump action: eight shells of buckshot, loaded one at a time,
 * with a pump stroke between every shot. Devastating inside a room and useless
 * outside one.
 */
export const R870: WeaponDefinition = {
  id: 'r870',
  name: 'REMINGTON 870',
  caliber: '12 gauge',
  fireModes: ['semi'],
  rpm: 300,
  magazineSize: 8,
  reserveAmmo: 48,
  reloadTime: 0.62,
  equipTime: 0.5,
  boltCycleTime: 0.58,
  reloadStyle: 'shells',
  recoil: {
    vertical: 0.075,
    horizontal: 0.014,
    climbPerShot: 0.02,
    maxClimb: 1.3,
    randomness: 0.28,
    snappiness: 24,
    recoverySpeed: 5.5,
    recoveryFraction: 0.72,
    kickback: 0.115,
    punch: 0.27,
    shake: 0.78,
  },
  spread: {
    base: 0.012,
    adsMultiplier: 0.66,
    perShot: 0.002,
    max: 0.026,
    recovery: 0.04,
    movePenalty: 0.006,
  },
  ads: { time: 0.28, fov: 63, sensitivityMultiplier: 0.72, recoilMultiplier: 0.9 },
  projectile: {
    velocity: 400,
    gravityMultiplier: 1,
    drag: 0.006,
    maxDistance: 200,
    damage: 26,
    pellets: 8,
  },
  movementMultiplier: 0.92,
  adsMovementMultiplier: 0.52,
  viewModel: {
    hipPosition: [0.17, -0.15, -0.38],
    hipRotation: [0.02, -0.06, 0.015],
    adsDistance: 0.33,
    swayAmount: 1.15,
    bobAmount: 1.05,
    weight: 28,
  },
  audio: {
    gain: 1,
    bodyFrequency: 58,
    crackFrequency: 980,
    decay: 0.22,
    tailDecay: 0.68,
    mechanical: 0.9,
    reverb: 0.8,
  },
};
