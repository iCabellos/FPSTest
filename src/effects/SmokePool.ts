import * as THREE from 'three';
import { LIMITS } from '../core/constants';
import { createGlowTexture } from '../rendering/textures';
import { InstancedPool } from './InstancedPool';

const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();

const LIFETIME = 0.7;

/** Camera facing muzzle smoke. All puffs share the camera orientation. */
export class SmokePool extends InstancedPool {
  private readonly positions: THREE.Vector3[] = [];
  private readonly lives: Float32Array;

  constructor(capacity: number = LIMITS.smokePuffs) {
    const material = new THREE.MeshBasicMaterial({
      map: createGlowTexture('rgba(190,186,178,0.55)', 'rgba(150,148,142,0)'),
      transparent: true,
      depthWrite: false,
      // Additive keeps it cheap and lets per instance colour act as opacity.
      blending: THREE.AdditiveBlending,
    });
    super(new THREE.PlaneGeometry(1, 1), material, capacity);
    this.mesh.renderOrder = 2;
    this.lives = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.positions.push(new THREE.Vector3());
      this.mesh.setColorAt(i, tmpColor.setScalar(0));
    }
  }

  puff(position: THREE.Vector3): void {
    const index = this.nextIndex();
    this.positions[index].copy(position);
    this.lives[index] = LIFETIME;
  }

  update(dt: number, cameraQuaternion: THREE.Quaternion): void {
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

      const age = 1 - remaining / LIFETIME;
      this.positions[i].y += dt * 0.5;
      // Kept small and dim: the puff sits less than a metre from the eye, so
      // anything larger washes the whole view out once puffs overlap.
      tmpScale.setScalar(0.05 + age * 0.2);
      tmpMatrix.compose(this.positions[i], cameraQuaternion, tmpScale);
      this.mesh.setMatrixAt(i, tmpMatrix);
      this.mesh.setColorAt(i, tmpColor.setScalar((1 - age) * 0.16));
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  override clear(): void {
    super.clear();
    this.lives.fill(0);
  }
}
