import * as THREE from 'three';
import type { AudioSystem } from '../audio/AudioSystem';
import type { EffectsSystem } from '../effects/EffectsSystem';
import { TargetField } from '../range/TargetField';
import type { TargetHitInfo } from '../range/Target';
import type { SessionStats } from '../stats/SessionStats';
import type { Weapon } from '../weapons/Weapon';
import type { ViewModel } from '../weapons/viewmodel/ViewModel';
import { BallisticsSystem, type ProjectileImpact, type SegmentScanner } from './Ballistics';
import { applyConeSpread } from './SpreadModel';

const AIM_PROBE_DISTANCE = 900;
/** Speed of sound, used to delay impact sounds at long range. */
const SOUND_SPEED = 343;

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpAimPoint = new THREE.Vector3();
const tmpMuzzle = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpEjection = new THREE.Vector3();
const tmpVelocity = new THREE.Vector3();

/** A segment scanner that can also measure what the crosshair covers. */
export interface AimScanner extends SegmentScanner {
  measure(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null;
}

export interface ShootingSystemDeps {
  camera: THREE.PerspectiveCamera;
  viewModel: ViewModel;
  scanner: AimScanner;
  effects: EffectsSystem;
  audio: AudioSystem;
  stats: SessionStats;
  /**
   * Lets a mode claim an impact before the default handling. Return true when
   * it was absorbed, so no bullet hole is punched into the world.
   */
  resolveImpact?: (impact: ProjectileImpact) => boolean;
}

/**
 * Turns a trigger pull into a round in flight, and a round in flight into an
 * impact: spread, muzzle effects, brass, projectile integration and hit
 * reactions all live here.
 */
export class ShootingSystem {
  readonly ballistics = new BallisticsSystem();

  /** Notified whenever a target is hit, so the HUD can flash. */
  onTargetHit: ((info: TargetHitInfo) => void) | null = null;

  private aimDistanceValue: number | null = null;

  constructor(private readonly deps: ShootingSystemDeps) {}

  /** Distance to whatever is under the crosshair, refreshed each frame. */
  get aimDistance(): number | null {
    return this.aimDistanceValue;
  }

  fire(weapon: Weapon, spread: number): void {
    const { camera, viewModel, scanner, effects, audio, stats } = this.deps;
    const definition = weapon.definition;

    camera.getWorldDirection(tmpForward);
    tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

    // Converge on whatever the crosshair covers so close range shots are not
    // thrown off by the muzzle being offset from the eye.
    const probe = scanner.measure(camera.position, tmpForward, AIM_PROBE_DISTANCE);
    tmpAimPoint
      .copy(camera.position)
      .addScaledVector(tmpForward, probe ?? AIM_PROBE_DISTANCE);

    viewModel.getMuzzleWorld(camera, tmpMuzzle);
    tmpDirection.subVectors(tmpAimPoint, tmpMuzzle).normalize();
    applyConeSpread(tmpDirection, spread, tmpRight, tmpUp);

    this.ballistics.spawn(tmpMuzzle, tmpDirection, definition.projectile);
    stats.recordShot();

    effects.fireFlash(tmpMuzzle, 0.7 + definition.projectile.damage / 160);
    viewModel.getEjectionWorld(camera, tmpEjection);
    tmpVelocity
      .copy(tmpRight)
      .multiplyScalar(1.6 + Math.random() * 0.8)
      .addScaledVector(tmpUp, 1.1 + Math.random() * 0.6)
      .addScaledVector(tmpForward, -0.4);
    effects.ejectCasing(tmpEjection, tmpVelocity);
    audio.playShot(definition.id, definition.audio);
  }

  update(dt: number): void {
    this.ballistics.update(dt, this.deps.scanner, this.handleImpact);

    const { camera, scanner } = this.deps;
    camera.getWorldDirection(tmpForward);
    this.aimDistanceValue = scanner.measure(camera.position, tmpForward, AIM_PROBE_DISTANCE);
  }

  private readonly handleImpact = (impact: ProjectileImpact): void => {
    const { effects, audio, stats } = this.deps;
    const { hit, projectile } = impact;
    const energy = projectile.damage / 100;

    if (this.deps.resolveImpact?.(impact)) {
      effects.spawnImpact(hit.point, hit.normal, energy, false);
      audio.play('impact', 1 / (1 + projectile.travelled * 0.03), projectile.travelled / SOUND_SPEED);
      return;
    }

    const target = hit.object ? TargetField.fromObject(hit.object) : null;

    if (target) {
      // Heavier rounds and smaller plates swing further.
      const impulse = (projectile.damage * 0.028) / Math.max(0.25, target.radius);
      const info = target.registerHit(hit.point, impulse);
      stats.recordHit(info.distance);
      // The plate keeps its own decals; only sparks are spawned here.
      effects.spawnImpact(hit.point, hit.normal, energy, false);
      this.onTargetHit?.(info);
    } else {
      effects.spawnImpact(hit.point, hit.normal, energy, true);
    }

    const distance = projectile.travelled;
    audio.play('impact', 1 / (1 + distance * 0.03), distance / SOUND_SPEED);
  };
}
