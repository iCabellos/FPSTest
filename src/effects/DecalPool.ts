import * as THREE from 'three';
import { LIMITS } from '../core/constants';
import { createBulletHoleTexture } from '../rendering/textures';
import { InstancedPool } from './InstancedPool';

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const tmpQuaternion = new THREE.Quaternion();
const tmpRoll = new THREE.Quaternion();
const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

/** Bullet holes on static geometry. Oldest holes are recycled first. */
export class DecalPool extends InstancedPool {
  constructor(capacity: number = LIMITS.decals) {
    const material = new THREE.MeshBasicMaterial({
      map: createBulletHoleTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    super(new THREE.PlaneGeometry(1, 1), material, capacity);
    this.mesh.renderOrder = 1;
  }

  spawn(point: THREE.Vector3, normal: THREE.Vector3, size: number): void {
    tmpQuaternion.setFromUnitVectors(PLANE_NORMAL, normal);
    tmpRoll.setFromAxisAngle(PLANE_NORMAL, Math.random() * Math.PI * 2);
    tmpQuaternion.multiply(tmpRoll);

    // Lift the quad slightly so it never z-fights with the surface.
    tmpPosition.copy(point).addScaledVector(normal, 0.012);
    tmpScale.setScalar(size);

    tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
    this.mesh.setMatrixAt(this.nextIndex(), tmpMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
