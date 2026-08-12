import * as THREE from 'three';
import { LIMITS } from '../core/constants';
import type { BallisticsSystem } from '../shooting/Ballistics';
import { InstancedPool } from './InstancedPool';

const UP = new THREE.Vector3(0, 1, 0);
const tmpDirection = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

const MAX_TRACER_LENGTH = 7;

/**
 * Draws one stretched quad per live round. Rebuilt each frame straight from
 * the ballistics pool, so tracers never outlive their bullet.
 */
export class TracerPool extends InstancedPool {
  private liveCount = 0;

  constructor(capacity: number = LIMITS.tracers) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffd493,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    super(new THREE.CylinderGeometry(0.016, 0.016, 1, 5, 1, true), material, capacity);
    this.mesh.renderOrder = 3;
  }

  syncFrom(ballistics: BallisticsSystem): void {
    let index = 0;
    ballistics.forEachActive((projectile) => {
      if (index >= this.capacity) return;

      const speed = projectile.speed;
      if (speed < 1e-3) return;
      tmpDirection.copy(projectile.velocity).divideScalar(speed);

      const length = Math.min(MAX_TRACER_LENGTH, projectile.travelled);
      if (length < 0.25) return;

      tmpCenter.copy(projectile.position).addScaledVector(tmpDirection, -length * 0.5);
      tmpQuaternion.setFromUnitVectors(UP, tmpDirection);
      tmpScale.set(1, length, 1);
      tmpMatrix.compose(tmpCenter, tmpQuaternion, tmpScale);
      this.mesh.setMatrixAt(index++, tmpMatrix);
    });

    if (index === 0 && this.liveCount === 0) return;
    for (let i = index; i < this.liveCount; i++) this.hide(i);
    this.liveCount = index;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  override clear(): void {
    super.clear();
    this.liveCount = 0;
  }
}
