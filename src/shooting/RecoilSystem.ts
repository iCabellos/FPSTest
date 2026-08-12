import type { RecoilConfig } from '../weapons/WeaponDefinition';
import { damp, randomSigned } from '../utils/math';
import type { RandomSource } from '../utils/Random';

export interface RecoilImpulse {
  /** Aim displacement that does not recover: the player has to pull back down. */
  permanentPitch: number;
  permanentYaw: number;
  /** View model reaction. */
  kickback: number;
  punch: number;
  shake: number;
}

/**
 * Deterministic horizontal pattern. Two out-of-phase sines give a repeatable
 * S shape that a player can learn, unlike pure noise.
 */
function patternAt(shotIndex: number): number {
  return Math.sin(shotIndex * 0.8) * 0.65 + Math.sin(shotIndex * 0.31 + 1.7) * 0.35;
}

/**
 * Splits every shot into a transient kick that springs back on its own and a
 * permanent displacement folded into the aim angles. The mix is per weapon,
 * so an M4 mostly self-corrects while an M60 walks off target.
 */
export class RecoilSystem {
  private pitch = 0;
  private yaw = 0;
  private targetPitch = 0;
  private targetYaw = 0;

  private readonly impulse: RecoilImpulse = {
    permanentPitch: 0,
    permanentYaw: 0,
    kickback: 0,
    punch: 0,
    shake: 0,
  };

  constructor(private readonly random: RandomSource = Math.random) {}

  /** Transient pitch offset currently applied to the camera. */
  get offsetPitch(): number {
    return this.pitch;
  }

  get offsetYaw(): number {
    return this.yaw;
  }

  /**
   * @param shotIndex 0-based index within the current burst.
   * @param adsScale recoil multiplier for the current ADS blend.
   */
  fire(config: RecoilConfig, shotIndex: number, adsScale: number): RecoilImpulse {
    const climb = Math.min(1 + shotIndex * config.climbPerShot, config.maxClimb);

    const verticalJitter = 1 + randomSigned(config.randomness * 0.35, this.random);
    const vertical = config.vertical * climb * verticalJitter * adsScale;

    const deterministic = patternAt(shotIndex) * (1 - config.randomness);
    const noise = randomSigned(config.randomness, this.random);
    const horizontal = config.horizontal * climb * (deterministic + noise) * adsScale;

    const transient = config.recoveryFraction;
    this.targetPitch += vertical * transient;
    this.targetYaw += horizontal * transient;

    this.impulse.permanentPitch = vertical * (1 - transient);
    this.impulse.permanentYaw = horizontal * (1 - transient);
    this.impulse.kickback = config.kickback * climb;
    this.impulse.punch = config.punch * climb;
    this.impulse.shake = config.shake;
    return this.impulse;
  }

  update(dt: number, config: RecoilConfig): void {
    this.pitch = damp(this.pitch, this.targetPitch, config.snappiness, dt);
    this.yaw = damp(this.yaw, this.targetYaw, config.snappiness, dt);
    this.targetPitch = damp(this.targetPitch, 0, config.recoverySpeed, dt);
    this.targetYaw = damp(this.targetYaw, 0, config.recoverySpeed, dt);

    if (Math.abs(this.pitch) < 1e-6 && Math.abs(this.targetPitch) < 1e-6) {
      this.pitch = 0;
      this.targetPitch = 0;
    }
    if (Math.abs(this.yaw) < 1e-6 && Math.abs(this.targetYaw) < 1e-6) {
      this.yaw = 0;
      this.targetYaw = 0;
    }
  }

  reset(): void {
    this.pitch = 0;
    this.yaw = 0;
    this.targetPitch = 0;
    this.targetYaw = 0;
  }
}
