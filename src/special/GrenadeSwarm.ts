import * as THREE from 'three';

/** Called when a grenade goes off, so the mode can damage and dress it. */
export type ExplosionHandler = (point: THREE.Vector3, radius: number, damage: number) => void;

export const GRENADE_RADIUS = 5.5;
export const GRENADE_DAMAGE = 320;
/** Seconds from leaving the horn to detonation. */
const FUSE = 1.5;
const LAUNCH_SPEED = 15;
const LAUNCH_LIFT = 5.5;
const GRAVITY = 9.81;
/** Energy kept after bouncing off the floor. */
const RESTITUTION = 0.34;
const DRAG = 0.35;
const BODY_RADIUS = 0.09;

const tmpMatrix = new THREE.Matrix4();
const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

interface Grenade {
  active: boolean;
  fuse: number;
  spin: number;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
}

/**
 * The grenades the special weapon throws.
 *
 * Pooled and drawn as a single instanced mesh, and integrated by hand rather
 * than handed to a physics engine: a grenade is a point with a velocity, a
 * gravity term and one floor bounce, which is all the fidelity a 1.5 second
 * flight needs.
 */
export class GrenadeSwarm {
  private readonly pool: Grenade[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.Material;

  constructor(
    private readonly scene: THREE.Scene,
    readonly capacity = 16,
  ) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        active: false,
        fuse: 0,
        spin: 0,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
      });
    }

    this.material = new THREE.MeshPhongMaterial({
      color: 0x2f3a2a,
      emissive: 0x6c2a12,
      emissiveIntensity: 0.4,
      shininess: 30,
    });
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(BODY_RADIUS, 1),
      this.material,
      capacity,
    );
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  get activeCount(): number {
    let count = 0;
    for (const grenade of this.pool) if (grenade.active) count++;
    return count;
  }

  /**
   * Throws one grenade along a compass bearing.
   *
   * @param bearingDegrees clockwise from world −Z, matching the angles the
   *   slot machine computes.
   * @returns false when the pool is saturated.
   */
  launch(origin: THREE.Vector3, bearingDegrees: number): boolean {
    const grenade = this.pool.find((candidate) => !candidate.active);
    if (!grenade) return false;

    const radians = (bearingDegrees * Math.PI) / 180;
    grenade.active = true;
    grenade.fuse = FUSE;
    grenade.spin = Math.random() * Math.PI;
    grenade.position.copy(origin);
    grenade.velocity.set(
      Math.sin(radians) * LAUNCH_SPEED,
      LAUNCH_LIFT,
      -Math.cos(radians) * LAUNCH_SPEED,
    );
    return true;
  }

  update(dt: number, onExplode: ExplosionHandler): void {
    for (const grenade of this.pool) {
      if (!grenade.active) continue;

      grenade.velocity.y -= GRAVITY * dt;
      grenade.velocity.multiplyScalar(Math.max(0, 1 - DRAG * dt));
      grenade.position.addScaledVector(grenade.velocity, dt);
      grenade.spin += dt * 9;

      if (grenade.position.y <= BODY_RADIUS) {
        grenade.position.y = BODY_RADIUS;
        grenade.velocity.y = Math.abs(grenade.velocity.y) * RESTITUTION;
        grenade.velocity.x *= 0.7;
        grenade.velocity.z *= 0.7;
      }

      grenade.fuse -= dt;
      if (grenade.fuse > 0) continue;

      grenade.active = false;
      onExplode(grenade.position, GRENADE_RADIUS, GRENADE_DAMAGE);
    }
    this.render();
  }

  clear(): void {
    for (const grenade of this.pool) grenade.active = false;
    this.render();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }

  private render(): void {
    let index = 0;
    for (const grenade of this.pool) {
      if (!grenade.active) continue;
      tmpPosition.copy(grenade.position);
      tmpQuaternion.setFromEuler(new THREE.Euler(grenade.spin, grenade.spin * 0.7, 0));
      tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
      this.mesh.setMatrixAt(index, tmpMatrix);
      index++;
    }
    for (let i = index; i < this.capacity; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
