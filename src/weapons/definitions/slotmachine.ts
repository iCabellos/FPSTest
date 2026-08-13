import { SPECIAL_AMMO } from '../../special/SlotMachine';
import type { WeaponDefinition } from '../WeaponDefinition';

/**
 * The special weapon. It fires no bullets at all: every pull spins five reels
 * and the reels decide what happens, so the projectile block below only exists
 * to satisfy the shared weapon contract and is never used — the zombies mode
 * intercepts its shots before ballistics ever see them.
 *
 * Thirty uses, no reserve. When it runs dry it is dry for good unless you buy
 * it again off the vault wall.
 */
export const SLOT_MACHINE: WeaponDefinition = {
  id: 'slotmachine',
  name: 'ONE ARMED BANDIT',
  caliber: '5 REELS',
  fireModes: ['semi'],
  rpm: 70,
  magazineSize: SPECIAL_AMMO,
  reserveAmmo: 0,
  reloadTime: 3.4,
  equipTime: 0.62,
  recoil: {
    // The lever slams down and the whole cabinet jumps.
    vertical: 0.09,
    horizontal: 0.03,
    climbPerShot: 0,
    maxClimb: 1,
    randomness: 0.4,
    snappiness: 18,
    recoverySpeed: 5,
    recoveryFraction: 0.95,
    kickback: 0.13,
    punch: 0.3,
    shake: 0.85,
  },
  spread: {
    base: 0.004,
    adsMultiplier: 0.5,
    perShot: 0.001,
    max: 0.007,
    recovery: 0.01,
    movePenalty: 0.002,
  },
  ads: {
    time: 0.34,
    fov: 66,
    sensitivityMultiplier: 0.82,
    recoilMultiplier: 1,
  },
  projectile: {
    velocity: 200,
    gravityMultiplier: 1,
    drag: 0.002,
    maxDistance: 60,
    damage: 0,
  },
  movementMultiplier: 0.78,
  adsMovementMultiplier: 0.52,
  viewModel: {
    hipPosition: [0.19, -0.19, -0.42],
    hipRotation: [0.03, -0.05, 0.02],
    adsDistance: 0.36,
    swayAmount: 1.5,
    bobAmount: 1.35,
    weight: 34,
  },
  audio: {
    gain: 0.72,
    bodyFrequency: 62,
    crackFrequency: 720,
    decay: 0.26,
    tailDecay: 0.7,
    mechanical: 1,
  },
};
