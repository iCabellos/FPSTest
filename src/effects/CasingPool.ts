import * as THREE from 'three';
import { GRAVITY, LIMITS } from '../core/constants';
import { InstancedPool } from './InstancedPool';

const tmpQuaternion = new THREE.Quaternion();
const tmpAxis = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

const LIFETIME = 3.5;
/** Top of the concrete slab the shooter stands on. */
const FLOOR_Y = 0.11;

/** Ejected brass with a cheap bounce, recycled after a few seconds. */
export class CasingPool extends InstancedPool {
  private readonly positions: THREE.Vector3[] = [];
  private readonly velocities: THREE.Vector3[] = [];
  private readonly axes: THREE.Vector3[] = [];
  private readonly spins: Float32Array;
  private readonly angles: Float32Array;
  private readonly lives: Float32Array;

  constructor(capacity: number = LIMITS.casings) {
    const material = new THREE.MeshPhongMaterial({ color: 0xc9a227, shininess: 90 });
    super(new THREE.CylinderGeometry(0.0055, 0.006, 0.024, 6), material, capacity);
    this.spins = new Float32Array(capacity);
    this.angles = new Float32Array(capacity);
    this.lives = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.positions.push(new THREE.Vector3());
      this.velocities.push(new THREE.Vector3());
      this.axes.push(new THREE.Vector3(0, 1, 0));
    }
  }

  eject(position: THREE.Vector3, velocity: THREE.Vector3): void {
    const index = this.nextIndex();
    this.positions[index].copy(position);
    this.velocities[index].copy(velocity);
    this.axes[index]
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize();
    this.spins[index] = 12 + Math.random() * 22;
    this.angles[index] = Math.random() * Math.PI;
    this.lives[index] = LIFETIME;
  }

  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.capacity; i++) {
      const life = this.lives[i];
      if (life <= 0) continue;

      const remaining = life - dt;
      this.lives[i] = remaining;
      dirty = true;
      if (remaining <= 0) {
        this.hide(i);
        continue;
      }

      const position = this.positions[i];
      const velocity = this.velocities[i];
      velocity.y -= GRAVITY * dt;
      position.addScaledVector(velocity, dt);

      if (position.y < FLOOR_Y) {
        position.y = FLOOR_Y;
        velocity.y = Math.abs(velocity.y) * 0.32;
        velocity.x *= 0.55;
        velocity.z *= 0.55;
        this.spins[i] *= 0.5;
        if (velocity.y < 0.25) velocity.set(0, 0, 0);
      }

      this.angles[i] += this.spins[i] * dt;
      tmpQuaternion.setFromAxisAngle(tmpAxis.copy(this.axes[i]), this.angles[i]);
      // Shrink out during the last moments instead of popping.
      const fade = remaining < 0.4 ? remaining / 0.4 : 1;
      tmpScale.setScalar(fade);
      tmpMatrix.compose(position, tmpQuaternion, tmpScale);
      this.mesh.setMatrixAt(i, tmpMatrix);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  override clear(): void {
    super.clear();
    this.lives.fill(0);
  }
}
