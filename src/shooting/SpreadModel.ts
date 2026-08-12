import type * as THREE from 'three';
import type { SpreadConfig } from '../weapons/WeaponDefinition';
import { decayToZero, lerp } from '../utils/math';
import type { RandomSource } from '../utils/Random';

/**
 * Accumulated inaccuracy ("bloom"). Sustained fire opens the cone up to a
 * ceiling and it closes again while the trigger is released.
 */
export class SpreadModel {
  private bloom = 0;

  get currentBloom(): number {
    return this.bloom;
  }

  addShot(config: SpreadConfig): void {
    this.bloom = Math.min(config.max, this.bloom + config.perShot);
  }

  update(dt: number, config: SpreadConfig): void {
    this.bloom = decayToZero(this.bloom, config.recovery, dt);
  }

  /**
   * Cone half angle in radians.
   * @param adsFactor 0 at the hip, 1 fully aimed.
   * @param moveFraction 0 standing still, 1 at full walking speed.
   */
  compute(config: SpreadConfig, adsFactor: number, moveFraction: number): number {
    const raw = config.base + this.bloom + config.movePenalty * moveFraction;
    return raw * lerp(1, config.adsMultiplier, adsFactor);
  }

  reset(): void {
    this.bloom = 0;
  }
}

/**
 * Offsets a unit direction inside a cone. The square root keeps the sample
 * density uniform across the disc instead of clustering in the middle.
 */
export function applyConeSpread(
  direction: THREE.Vector3,
  halfAngle: number,
  right: THREE.Vector3,
  up: THREE.Vector3,
  random: RandomSource = Math.random,
): void {
  if (halfAngle <= 0) return;
  const angle = random() * Math.PI * 2;
  const radius = Math.tan(halfAngle) * Math.sqrt(random());
  direction.addScaledVector(right, Math.cos(angle) * radius);
  direction.addScaledVector(up, Math.sin(angle) * radius);
  direction.normalize();
}
