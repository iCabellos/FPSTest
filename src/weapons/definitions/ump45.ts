import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * Slow, heavy .45. Each round thumps and the cadence gives you time to ride
 * it, but the subsonic bullet arcs hard past 100 m.
 */
export const UMP45: WeaponDefinition = {
  id: 'ump45',
  name: 'UMP45',
  caliber: '.45 ACP',
  fireModes: ['auto', 'semi'],
  rpm: 600,
  magazineSize: 25,
  reserveAmmo: 200,
  reloadTime: 2.9,
  equipTime: 0.6,
  recoil: {
    vertical: 0.031,
    horizontal: 0.014,
    climbPerShot: 0.06,
    maxClimb: 2,
    randomness: 0.34,
    snappiness: 26,
    recoverySpeed: 5.5,
    recoveryFraction: 0.62,
    kickback: 0.07,
    punch: 0.15,
    shake: 0.45,
  },
  spread: {
    base: 0.0027,
    adsMultiplier: 0.27,
    perShot: 0.0013,
    max: 0.014,
    recovery: 0.021,
    movePenalty: 0.005,
  },
  ads: {
    time: 0.21,
    fov: 59,
    sensitivityMultiplier: 0.69,
    recoilMultiplier: 0.8,
  },
  projectile: {
    velocity: 290,
    gravityMultiplier: 1,
    drag: 0.0022,
    maxDistance: 220,
    damage: 34,
  },
  movementMultiplier: 0.99,
  adsMovementMultiplier: 0.52,
  viewModel: {
    hipPosition: [0.17, -0.16, -0.34],
    hipRotation: [0.02, -0.06, 0.02],
    adsDistance: 0.31,
    swayAmount: 1.05,
    bobAmount: 1,
    weight: 16,
  },
  audio: {
    gain: 0.72,
    bodyFrequency: 78,
    crackFrequency: 1450,
    decay: 0.17,
    tailDecay: 0.42,
    mechanical: 0.8,
    reverb: 0.5,
  },
};
