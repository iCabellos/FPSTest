import * as THREE from 'three';
import { RANGE } from '../core/constants';
import { createBulletHoleTexture, createTargetFaceTexture } from '../rendering/textures';
import { Target } from './Target';

/** Builds and drives every steel plate in the range. */
export class TargetField {
  readonly group = new THREE.Group();
  readonly targets: Target[] = [];
  /** Meshes bullets can intersect; each carries a `userData.target` back link. */
  readonly colliders: THREE.Object3D[] = [];

  private readonly decalGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly decalMaterial: THREE.Material;
  private readonly postMaterial: THREE.Material;
  private readonly faceTexture: THREE.Texture;

  constructor(scene: THREE.Scene) {
    this.faceTexture = createTargetFaceTexture();
    this.postMaterial = new THREE.MeshLambertMaterial({ color: 0x53575c });
    this.decalMaterial = new THREE.MeshBasicMaterial({
      map: createBulletHoleTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    RANGE.laneCenters.forEach((laneX) => {
      RANGE.targetDistances.forEach((distance, index) => {
        // Stagger targets inside the lane so nothing hides behind anything else.
        const offset = (index - 1.5) * 0.55;
        const target = new Target({
          x: laneX + offset,
          z: -distance,
          radius: RANGE.targetRadii[index],
          faceTexture: this.faceTexture,
          postMaterial: this.postMaterial,
          decalGeometry: this.decalGeometry,
          decalMaterial: this.decalMaterial,
        });
        this.targets.push(target);
        this.colliders.push(target.plate);
        this.group.add(target.group);
      });
    });

    scene.add(this.group);
  }

  update(dt: number): void {
    for (const target of this.targets) target.update(dt);
  }

  resetAll(): void {
    for (const target of this.targets) target.reset();
  }

  /** Maps an intersected object back to its target, if any. */
  static fromObject(object: THREE.Object3D): Target | null {
    return (object.userData.target as Target | undefined) ?? null;
  }

  dispose(): void {
    for (const target of this.targets) target.dispose();
    this.targets.length = 0;
    this.colliders.length = 0;
    this.decalGeometry.dispose();
    this.decalMaterial.dispose();
    this.postMaterial.dispose();
    this.group.removeFromParent();
  }
}
