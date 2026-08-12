import * as THREE from 'three';
import { GRAVITY, LIMITS } from '../core/constants';
import { InstancedPool } from './InstancedPool';

const UP = new THREE.Vector3(0, 1, 0);
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

const SPARKS_PER_IMPACT = 7;
const LIFETIME = 0.32;

/** Short lived stretched sparks thrown out of every impact. */
export class SparkPool extends InstancedPool {
  private readonly positions: THREE.Vector3[] = [];
  private readonly velocities: THREE.Vector3[] = [];
  private readonly lives: Float32Array;

  constructor(capacity: number = LIMITS.sparks) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffc46a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    super(new THREE.BoxGeometry(1, 1, 1), material, capacity);
    this.lives = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.positions.push(new THREE.Vector3());
      this.velocities.push(new THREE.Vector3());
    }
  }

  burst(point: THREE.Vector3, normal: THREE.Vector3, energy: number): void {
    for (let i = 0; i < SPARKS_PER_IMPACT; i++) {
      const index = this.nextIndex();
      this.positions[index].copy(point);
      this.velocities[index]
        .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(1.4 + Math.random() * 2.6)
        .addScaledVector(normal, 2.2 + Math.random() * 2 * energy);
      this.lives[index] = LIFETIME * (0.6 + Math.random() * 0.7);
    }
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

      const velocity = this.velocities[i];
      velocity.y -= GRAVITY * dt;
      velocity.multiplyScalar(1 - Math.min(1, 2.4 * dt));
      this.positions[i].addScaledVector(velocity, dt);

      const speed = velocity.length();
      if (speed > 1e-4) {
        tmpDirection.copy(velocity).divideScalar(speed);
        tmpQuaternion.setFromUnitVectors(UP, tmpDirection);
      }
      const fade = remaining / LIFETIME;
      tmpScale.set(0.012, Math.min(0.3, speed * 0.02 + 0.03) * fade, 0.012);
      tmpMatrix.compose(this.positions[i], tmpQuaternion, tmpScale);
      this.mesh.setMatrixAt(i, tmpMatrix);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  override clear(): void {
    super.clear();
    this.lives.fill(0);
  }
}
