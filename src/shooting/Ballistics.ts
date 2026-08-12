import * as THREE from 'three';
import { GRAVITY, LIMITS } from '../core/constants';
import type { ProjectileConfig } from '../weapons/WeaponDefinition';

export interface SegmentHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  object: THREE.Object3D | null;
  /** Distance from the segment start. */
  distance: number;
}

/** Anything able to resolve "what does this segment touch first". */
export interface SegmentScanner {
  scan(from: THREE.Vector3, to: THREE.Vector3, out: SegmentHit): boolean;
}

export class Projectile {
  active = false;
  readonly position = new THREE.Vector3();
  readonly previous = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  travelled = 0;
  time = 0;
  gravity = 0;
  drag = 0;
  maxDistance = 0;
  damage = 0;
  speed = 0;
}

export interface ProjectileImpact {
  projectile: Projectile;
  hit: SegmentHit;
}

export type ImpactHandler = (impact: ProjectileImpact) => void;

const scratchHit: SegmentHit = {
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  object: null,
  distance: 0,
};

/**
 * Light ballistics: every round is a point integrated with gravity and
 * quadratic drag, and collisions are segment casts between the previous and
 * current position. No rigid bodies, no per-bullet scene objects.
 */
export class BallisticsSystem {
  private readonly pool: Projectile[] = [];
  private cursor = 0;
  private readonly impact: ProjectileImpact;

  constructor(capacity: number = LIMITS.projectiles) {
    for (let i = 0; i < capacity; i++) this.pool.push(new Projectile());
    this.impact = { projectile: this.pool[0], hit: scratchHit };
  }

  get activeCount(): number {
    let count = 0;
    for (const projectile of this.pool) if (projectile.active) count++;
    return count;
  }

  /** Fires a round. Reuses the oldest slot when the pool is saturated. */
  spawn(origin: THREE.Vector3, direction: THREE.Vector3, config: ProjectileConfig): Projectile {
    const projectile = this.acquire();
    projectile.active = true;
    projectile.position.copy(origin);
    projectile.previous.copy(origin);
    projectile.velocity.copy(direction).normalize().multiplyScalar(config.velocity);
    projectile.speed = config.velocity;
    projectile.travelled = 0;
    projectile.time = 0;
    projectile.gravity = GRAVITY * config.gravityMultiplier;
    projectile.drag = config.drag;
    projectile.maxDistance = config.maxDistance;
    projectile.damage = config.damage;
    return projectile;
  }

  update(dt: number, scanner: SegmentScanner, onImpact: ImpactHandler): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      projectile.previous.copy(projectile.position);

      // dv/dt = -drag * v²  →  applied along the velocity direction.
      const speed = projectile.velocity.length();
      if (projectile.drag > 0 && speed > 0) {
        const decay = 1 - projectile.drag * speed * dt;
        projectile.velocity.multiplyScalar(decay > 0 ? decay : 0);
      }
      projectile.velocity.y -= projectile.gravity * dt;
      projectile.position.addScaledVector(projectile.velocity, dt);

      const stepLength = projectile.position.distanceTo(projectile.previous);
      projectile.travelled += stepLength;
      projectile.time += dt;
      projectile.speed = projectile.velocity.length();

      if (scanner.scan(projectile.previous, projectile.position, scratchHit)) {
        projectile.active = false;
        projectile.travelled -= stepLength - scratchHit.distance;
        this.impact.projectile = projectile;
        onImpact(this.impact);
        continue;
      }

      if (projectile.travelled >= projectile.maxDistance || projectile.position.y < -2) {
        projectile.active = false;
      }
    }
  }

  /** Iterates live rounds so renderers can draw tracers without copies. */
  forEachActive(callback: (projectile: Projectile) => void): void {
    for (const projectile of this.pool) if (projectile.active) callback(projectile);
  }

  clear(): void {
    for (const projectile of this.pool) projectile.active = false;
  }

  /** Next free slot, falling back to the oldest live round. */
  private acquire(): Projectile {
    const size = this.pool.length;
    for (let offset = 0; offset < size; offset++) {
      const index = (this.cursor + offset) % size;
      if (!this.pool[index].active) {
        this.cursor = (index + 1) % size;
        return this.pool[index];
      }
    }
    const oldest = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % size;
    return oldest;
  }
}
