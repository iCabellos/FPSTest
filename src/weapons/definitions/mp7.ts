import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * Tiny high velocity PDW round. The fastest cadence and the lightest kick on
 * the range, but it wanders sideways and sheds speed quickly past 150 m.
 */
export const MP7: WeaponDefinition = {
  id: 'mp7',
  name: 'MP7',
  caliber: '4.6 x 30',
  fireModes: ['auto', 'semi'],
  rpm: 950,
  magazineSize: 40,
  reserveAmmo: 280,
  reloadTime: 2.4,
  equipTime: 0.45,
  recoil: {
    vertical: 0.0145,
    horizontal: 0.0125,
    climbPerShot: 0.05,
    maxClimb: 1.9,
    // Light bolt, light gun: where it goes is less predictable than an MP5.
    randomness: 0.5,
    snappiness: 36,
    recoverySpeed: 7.5,
    recoveryFraction: 0.76,
    kickback: 0.034,
    punch: 0.075,
    shake: 0.22,
  },
  spread: {
    base: 0.0026,
    adsMultiplier: 0.3,
    perShot: 0.00095,
    max: 0.013,
    recovery: 0.022,
    movePenalty: 0.004,
  },
  ads: {
    time: 0.17,
    fov: 61,
    sensitivityMultiplier: 0.72,
    recoilMultiplier: 0.76,
  },
  projectile: {
    velocity: 720,
    gravityMultiplier: 1,
    drag: 0.0019,
    maxDistance: 300,
    damage: 20,
  },
  movementMultiplier: 1.12,
  adsMovementMultiplier: 0.64,
  viewModel: {
    hipPosition: [0.15, -0.14, -0.3],
    hipRotation: [0.02, -0.07, 0.015],
    adsDistance: 0.27,
    swayAmount: 0.8,
    bobAmount: 0.85,
    weight: 22,
  },
  audio: {
    gain: 0.46,
    bodyFrequency: 132,
    crackFrequency: 2600,
    decay: 0.085,
    tailDecay: 0.24,
    mechanical: 0.95,
    reverb: 0.32,
  },
};
