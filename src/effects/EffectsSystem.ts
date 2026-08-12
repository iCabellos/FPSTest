import * as THREE from 'three';
import { CasingPool } from './CasingPool';
import { DecalPool } from './DecalPool';
import { SmokePool } from './SmokePool';
import { SparkPool } from './SparkPool';
import { TracerPool } from './TracerPool';
import type { BallisticsSystem } from '../shooting/Ballistics';

const MUZZLE_LIGHT_DECAY = 14;
/** Minimum gap between smoke puffs so automatic fire does not stack them. */
const SMOKE_INTERVAL = 0.14;
const tmpVector = new THREE.Vector3();

/**
 * Single entry point for transient visuals. Everything here is pooled and
 * bounded, so a long session cannot grow the scene graph.
 */
export class EffectsSystem {
  private readonly decals = new DecalPool();
  private readonly sparks = new SparkPool();
  private readonly casings = new CasingPool();
  private readonly tracers = new TracerPool();
  private readonly smoke = new SmokePool();
  private readonly muzzleLight: THREE.PointLight;
  private muzzleLightEnergy = 0;
  private smokeCooldown = 0;

  constructor(private readonly scene: THREE.Scene) {
    scene.add(
      this.decals.mesh,
      this.sparks.mesh,
      this.casings.mesh,
      this.tracers.mesh,
      this.smoke.mesh,
    );

    // Kept in the scene at zero intensity so light counts never change and
    // materials are never recompiled mid game.
    this.muzzleLight = new THREE.PointLight(0xffb765, 0, 14, 2);
    this.muzzleLight.castShadow = false;
    scene.add(this.muzzleLight);
  }

  /** Bullet hole plus sparks on static geometry. */
  spawnImpact(point: THREE.Vector3, normal: THREE.Vector3, energy: number, decal: boolean): void {
    if (decal) this.decals.spawn(point, normal, 0.075 + energy * 0.05);
    this.sparks.burst(point, normal, energy);
  }

  ejectCasing(position: THREE.Vector3, velocity: THREE.Vector3): void {
    this.casings.eject(position, velocity);
  }

  /** Lights the world from the muzzle and adds a small smoke puff. */
  fireFlash(worldMuzzle: THREE.Vector3, intensity: number): void {
    this.muzzleLight.position.copy(worldMuzzle);
    this.muzzleLightEnergy = Math.min(1, this.muzzleLightEnergy + intensity);
    if (this.smokeCooldown <= 0) {
      this.smoke.puff(tmpVector.copy(worldMuzzle));
      this.smokeCooldown = SMOKE_INTERVAL;
    }
  }

  update(dt: number, ballistics: BallisticsSystem, cameraQuaternion: THREE.Quaternion): void {
    this.smokeCooldown -= dt;
    this.sparks.update(dt);
    this.casings.update(dt);
    this.smoke.update(dt, cameraQuaternion);
    this.tracers.syncFrom(ballistics);

    if (this.muzzleLightEnergy > 0) {
      this.muzzleLightEnergy = Math.max(0, this.muzzleLightEnergy - MUZZLE_LIGHT_DECAY * dt);
      this.muzzleLight.intensity = this.muzzleLightEnergy * 22;
    }
  }

  clear(): void {
    this.decals.clear();
    this.sparks.clear();
    this.casings.clear();
    this.tracers.clear();
    this.smoke.clear();
  }

  dispose(): void {
    this.decals.dispose();
    this.sparks.dispose();
    this.casings.dispose();
    this.tracers.dispose();
    this.smoke.dispose();
    this.scene.remove(this.muzzleLight);
    this.muzzleLight.dispose();
  }
}
