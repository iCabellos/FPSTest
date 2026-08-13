import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * G36. The most controllable rifle here: a fast, flat, forgiving cadence, paid
 * for with less punch per round than the SCAR or the FAL.
 */
export const G36: WeaponDefinition = {
  id: 'g36',
  name: 'G36C',
  caliber: '5.56x45mm',
  fireModes: ['auto', 'semi'],
  rpm: 750,
  magazineSize: 30,
  reserveAmmo: 270,
  reloadTime: 2.35,
  equipTime: 0.46,
  recoil: {
    vertical: 0.023,
    horizontal: 0.008,
    climbPerShot: 0.045,
    maxClimb: 1.8,
    randomness: 0.2,
    snappiness: 34,
    recoverySpeed: 10,
    recoveryFraction: 0.74,
    kickback: 0.04,
    punch: 0.1,
    shake: 0.3,
  },
  spread: {
    base: 0.0024,
    adsMultiplier: 0.19,
    perShot: 0.001,
    max: 0.019,
    recovery: 0.044,
    movePenalty: 0.0065,
  },
  ads: { time: 0.22, fov: 59, sensitivityMultiplier: 0.7, recoilMultiplier: 0.74 },
  projectile: { velocity: 830, gravityMultiplier: 1, drag: 0.0012, maxDistance: 440, damage: 32 },
  movementMultiplier: 0.98,
  adsMovementMultiplier: 0.55,
  viewModel: {
    hipPosition: [0.165, -0.145, -0.36],
    hipRotation: [0.02, -0.06, 0.015],
    adsDistance: 0.33,
    swayAmount: 0.98,
    bobAmount: 0.98,
    weight: 24,
  },
  audio: {
    gain: 0.74,
    bodyFrequency: 92,
    crackFrequency: 1780,
    decay: 0.12,
    tailDecay: 0.4,
    mechanical: 0.66,
    reverb: 0.58,
  },
};
