import * as THREE from 'three';
import { LIMITS } from '../core/constants';

const SPRING_STIFFNESS = 55;
const SPRING_DAMPING = 4.6;
const MAX_SWING = 1.15;
const FLASH_DECAY = 4.5;

const tmpLocal = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const HIDDEN_SCALE = new THREE.Vector3(0, 0, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

export interface TargetHitInfo {
  /** Metres from the firing line, useful for the HUD and stats. */
  distance: number;
  /** 0 at the bullseye, 1 at the rim. */
  offCenter: number;
}

/**
 * A steel plate hinged at the top. Impacts push it back and a torsion spring
 * brings it upright, which reads as weight without any physics engine.
 */
export class Target {
  readonly group = new THREE.Group();
  readonly plate: THREE.Mesh;
  readonly distance: number;
  readonly radius: number;

  private readonly pivot = new THREE.Group();
  private readonly material: THREE.MeshPhongMaterial;
  private readonly decals: THREE.InstancedMesh;
  private readonly frame: THREE.Mesh;
  private decalCursor = 0;
  private angle = 0;
  private angularVelocity = 0;
  private flash = 0;
  private hits = 0;

  constructor(params: {
    x: number;
    z: number;
    radius: number;
    faceTexture: THREE.Texture;
    postMaterial: THREE.Material;
    decalGeometry: THREE.BufferGeometry;
    decalMaterial: THREE.Material;
  }) {
    this.distance = Math.abs(params.z);
    this.radius = params.radius;

    const plateCenterHeight = Math.max(1.1, params.radius * 1.4);
    const hingeHeight = plateCenterHeight + params.radius + 0.08;

    this.material = new THREE.MeshPhongMaterial({
      map: params.faceTexture,
      shininess: 24,
      specular: 0x30302c,
      side: THREE.DoubleSide,
      emissive: 0xff7a2a,
      emissiveIntensity: 0,
    });

    this.plate = new THREE.Mesh(new THREE.CircleGeometry(params.radius, 28), this.material);
    this.plate.position.y = -(params.radius + 0.08);
    this.plate.castShadow = true;
    this.plate.receiveShadow = true;
    this.plate.userData.target = this;

    this.decals = new THREE.InstancedMesh(
      params.decalGeometry,
      params.decalMaterial,
      LIMITS.targetDecals,
    );
    this.decals.frustumCulled = false;
    this.decals.position.z = 0.004;
    this.decals.renderOrder = 2;
    for (let i = 0; i < LIMITS.targetDecals; i++) {
      tmpMatrix.compose(tmpLocal.set(0, 0, 0), tmpQuaternion.identity(), HIDDEN_SCALE);
      this.decals.setMatrixAt(i, tmpMatrix);
    }
    this.decals.instanceMatrix.needsUpdate = true;
    this.plate.add(this.decals);

    this.pivot.position.y = hingeHeight;
    this.pivot.add(this.plate);

    this.frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, hingeHeight, 0.06), params.postMaterial);
    this.frame.position.y = hingeHeight / 2;
    this.frame.castShadow = true;
    this.frame.matrixAutoUpdate = false;
    this.frame.updateMatrix();

    this.group.position.set(params.x, 0, params.z);
    this.group.add(this.frame, this.pivot);
  }

  /** Applies the visual reaction and records the impact. Returns hit details. */
  registerHit(worldPoint: THREE.Vector3, impulse: number): TargetHitInfo {
    this.hits++;
    this.angularVelocity += impulse;
    this.flash = 1;

    this.plate.worldToLocal(tmpLocal.copy(worldPoint));
    const offCenter = Math.min(1, Math.hypot(tmpLocal.x, tmpLocal.y) / this.radius);
    this.addDecal(tmpLocal.x, tmpLocal.y);

    return { distance: this.distance, offCenter };
  }

  update(dt: number): void {
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - FLASH_DECAY * dt);
      this.material.emissiveIntensity = this.flash * 0.9;
    }

    if (this.angle === 0 && this.angularVelocity === 0) return;

    this.angularVelocity += (-SPRING_STIFFNESS * this.angle - SPRING_DAMPING * this.angularVelocity) * dt;
    this.angle += this.angularVelocity * dt;

    if (this.angle > MAX_SWING) {
      this.angle = MAX_SWING;
      this.angularVelocity = 0;
    } else if (this.angle < -0.15) {
      this.angle = -0.15;
      this.angularVelocity = 0;
    }

    if (Math.abs(this.angle) < 1e-4 && Math.abs(this.angularVelocity) < 1e-3) {
      this.angle = 0;
      this.angularVelocity = 0;
    }
    this.pivot.rotation.x = this.angle;
  }

  reset(): void {
    this.hits = 0;
    this.angle = 0;
    this.angularVelocity = 0;
    this.flash = 0;
    this.material.emissiveIntensity = 0;
    this.pivot.rotation.x = 0;
    this.decalCursor = 0;
    for (let i = 0; i < LIMITS.targetDecals; i++) {
      tmpMatrix.compose(tmpLocal.set(0, 0, 0), tmpQuaternion.identity(), HIDDEN_SCALE);
      this.decals.setMatrixAt(i, tmpMatrix);
    }
    this.decals.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.material.dispose();
    this.plate.geometry.dispose();
    this.frame.geometry.dispose();
    this.decals.dispose();
    this.group.removeFromParent();
  }

  private addDecal(x: number, y: number): void {
    const size = Math.max(0.07, this.radius * 0.22);
    tmpQuaternion.setFromAxisAngle(FORWARD, Math.random() * Math.PI * 2);
    tmpMatrix.compose(tmpLocal.set(x, y, 0), tmpQuaternion, tmpScale.set(size, size, size));
    this.decals.setMatrixAt(this.decalCursor, tmpMatrix);
    this.decals.instanceMatrix.needsUpdate = true;
    this.decalCursor = (this.decalCursor + 1) % LIMITS.targetDecals;
  }
}
