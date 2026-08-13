import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * Seven rounds of .45. Each shot lands noticeably harder than the M9 and
 * kicks for it, so the magazine is gone in a hurry.
 */
export const M1911: WeaponDefinition = {
  id: 'm1911',
  name: 'M1911',
  caliber: '.45 ACP',
  fireModes: ['semi'],
  rpm: 380,
  magazineSize: 7,
  reserveAmmo: 56,
  reloadTime: 2.3,
  equipTime: 0.38,
  recoil: {
    vertical: 0.038,
    horizontal: 0.012,
    climbPerShot: 0.05,
    maxClimb: 1.7,
    randomness: 0.32,
    snappiness: 30,
    recoverySpeed: 7,
    recoveryFraction: 0.72,
    kickback: 0.078,
    punch: 0.165,
    shake: 0.42,
  },
  spread: {
    base: 0.0029,
    adsMultiplier: 0.22,
    perShot: 0.0016,
    max: 0.013,
    recovery: 0.024,
    movePenalty: 0.0055,
  },
  ads: {
    time: 0.18,
    fov: 61,
    sensitivityMultiplier: 0.7,
    recoilMultiplier: 0.82,
  },
  projectile: {
    velocity: 260,
    gravityMultiplier: 1,
    drag: 0.0023,
    maxDistance: 200,
    damage: 42,
  },
  movementMultiplier: 1.08,
  adsMovementMultiplier: 0.64,
  viewModel: {
    hipPosition: [0.15, -0.14, -0.3],
    hipRotation: [0.02, -0.07, 0.015],
    adsDistance: 0.29,
    swayAmount: 0.9,
    bobAmount: 0.92,
    weight: 22,
  },
  audio: {
    gain: 0.68,
    bodyFrequency: 88,
    crackFrequency: 1550,
    decay: 0.15,
    tailDecay: 0.38,
    mechanical: 0.72,
    reverb: 0.48,
  },
};
