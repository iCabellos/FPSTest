import * as THREE from 'three';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Ring buffer of instances sharing one draw call. Slots are recycled in
 * order, which caps the number of live effects without any allocation.
 */
export abstract class InstancedPool {
  readonly mesh: THREE.InstancedMesh;
  protected cursor = 0;

  protected constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    readonly capacity: number,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Index of the next slot to overwrite. */
  protected nextIndex(): number {
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    return index;
  }

  protected hide(index: number): void {
    this.mesh.setMatrixAt(index, HIDDEN);
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) this.hide(i);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cursor = 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}
