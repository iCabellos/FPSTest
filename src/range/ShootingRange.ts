import * as THREE from 'three';
import { RANGE } from '../core/constants';
import { createNoiseTexture, createSignTexture } from '../rendering/textures';
import { disposeObject } from '../utils/three';

export interface BoxObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const DARK_METAL = 0x4a4d52;

/** Canopy geometry, tuned so the firing position keeps an open field of view. */
const STALL = { roofHeight: 4.05, roofDepth: 6.6, roofCenterZ: 5.5 } as const;

/**
 * Static geometry of the range: firing stall, lanes, walls, backstop and the
 * distance references. Everything a bullet can hit is exposed as a collider.
 */
export class ShootingRange {
  readonly group = new THREE.Group();
  readonly colliders: THREE.Object3D[] = [];
  readonly obstacles: BoxObstacle[] = [];

  private readonly concreteMaterial: THREE.Material;
  private readonly groundMaterial: THREE.Material;
  private readonly gravelMaterial: THREE.Material;
  private readonly roofMaterial: THREE.Material;

  constructor(scene: THREE.Scene) {
    this.groundMaterial = new THREE.MeshLambertMaterial({
      map: createNoiseTexture('#6f7a52', 26, 90),
    });
    this.gravelMaterial = new THREE.MeshLambertMaterial({
      map: createNoiseTexture('#8d867a', 34, 60),
    });
    this.concreteMaterial = new THREE.MeshLambertMaterial({
      map: createNoiseTexture('#a3a09a', 16, 8),
    });
    // The canopy underside fills the top of the frame, so it is kept light.
    this.roofMaterial = new THREE.MeshLambertMaterial({ color: 0xb9b4a8 });

    this.buildGround();
    this.buildStall();
    this.buildLaneDividers();
    this.buildBoundaryWalls();
    this.buildBackstop();
    this.buildDistanceReferences();

    scene.add(this.group);
  }

  dispose(): void {
    disposeObject(this.group);
    this.concreteMaterial.dispose();
    this.groundMaterial.dispose();
    this.gravelMaterial.dispose();
    this.roofMaterial.dispose();
    this.colliders.length = 0;
    this.obstacles.length = 0;
  }

  private add(mesh: THREE.Mesh, options: { collider?: boolean; shadow?: boolean } = {}): THREE.Mesh {
    const { collider = true, shadow = true } = options;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    if (collider) this.colliders.push(mesh);
    return mesh;
  }

  private box(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  private buildGround(): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -160;
    this.add(ground, { shadow: false });

    // Gravel surface along the lanes so shots read against a neutral surface.
    const gravel = new THREE.Mesh(new THREE.PlaneGeometry(26, 250), this.gravelMaterial);
    gravel.rotation.x = -Math.PI / 2;
    gravel.position.set(0, 0.012, -114);
    this.add(gravel, { shadow: false });
  }

  private buildStall(): void {
    const { roofHeight, roofDepth, roofCenterZ } = STALL;

    const slab = this.box(22, 0.12, 9.5, 0, 0.03, 4.2, this.concreteMaterial);
    this.add(slab, { shadow: false });

    // Shooting bench in front of the firing line, kept below the sight line.
    this.add(this.box(20, 0.12, 0.7, 0, 0.98, 0.45, this.concreteMaterial));
    this.add(this.box(20, 0.86, 0.18, 0, 0.49, 0.7, this.concreteMaterial));

    // Canopy sits high and stops short of the firing line so it never eats
    // into the view down range. Its posts double as player obstacles.
    this.add(this.box(21, 0.24, roofDepth, 0, roofHeight, roofCenterZ, this.roofMaterial));

    const postGeometry = new THREE.BoxGeometry(0.26, roofHeight, 0.26);
    const postMaterial = new THREE.MeshLambertMaterial({ color: DARK_METAL });
    const posts = new THREE.InstancedMesh(postGeometry, postMaterial, 4);
    posts.castShadow = true;
    posts.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const frontZ = roofCenterZ - roofDepth / 2 + 0.3;
    const backZ = roofCenterZ + roofDepth / 2 - 0.3;
    const postSpots: Array<[number, number]> = [
      [-8.2, frontZ],
      [8.2, frontZ],
      [-8.2, backZ],
      [8.2, backZ],
    ];
    postSpots.forEach(([x, z], index) => {
      matrix.makeTranslation(x, roofHeight / 2, z);
      posts.setMatrixAt(index, matrix);
      this.obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    });
    posts.instanceMatrix.needsUpdate = true;
    this.group.add(posts);
    this.colliders.push(posts);

    // Back wall closing the stall.
    this.add(this.box(21, roofHeight, 0.3, 0, roofHeight / 2, 8.3, this.concreteMaterial));
  }

  private buildLaneDividers(): void {
    const geometry = new THREE.BoxGeometry(0.35, 1, 26);
    const material = new THREE.MeshLambertMaterial({ map: createNoiseTexture('#8e8b84', 18, 4) });
    const dividerX = [-8, -4, 0, 4, 8];
    const dividers = new THREE.InstancedMesh(geometry, material, dividerX.length);
    dividers.castShadow = true;
    dividers.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    dividerX.forEach((x, index) => {
      matrix.makeTranslation(x, 0.5, -13);
      dividers.setMatrixAt(index, matrix);
    });
    dividers.instanceMatrix.needsUpdate = true;
    this.group.add(dividers);
    this.colliders.push(dividers);
  }

  private buildBoundaryWalls(): void {
    const { wallHeight } = RANGE;
    this.add(this.box(0.4, wallHeight, 60, -10.4, wallHeight / 2, -22, this.concreteMaterial));
    this.add(this.box(0.4, wallHeight, 60, 10.4, wallHeight / 2, -22, this.concreteMaterial));
  }

  private buildBackstop(): void {
    const bermMaterial = new THREE.MeshLambertMaterial({
      map: createNoiseTexture('#7c6c52', 30, 40),
    });
    // Stepped backstop behind the 200 m line. Nothing is placed between the
    // firing line and the last target row, so every plate stays visible.
    const main = new THREE.Mesh(new THREE.BoxGeometry(320, 16, 10), bermMaterial);
    main.position.set(0, 6, -RANGE.backstopDistance);
    this.add(main, { shadow: false });

    const step = new THREE.Mesh(new THREE.BoxGeometry(320, 5, 6), bermMaterial);
    step.position.set(0, 2.5, -(RANGE.backstopDistance - 7));
    this.add(step, { shadow: false });
  }

  private buildDistanceReferences(): void {
    const stripeMaterial = new THREE.MeshLambertMaterial({ color: 0xe8e2cf });
    const signPostGeometry = new THREE.BoxGeometry(0.12, 2.2, 0.12);
    const signPostMaterial = new THREE.MeshLambertMaterial({ color: DARK_METAL });
    const signPosts = new THREE.InstancedMesh(
      signPostGeometry,
      signPostMaterial,
      RANGE.targetDistances.length * 2,
    );
    signPosts.castShadow = true;
    const matrix = new THREE.Matrix4();
    const signGeometry = new THREE.PlaneGeometry(1.5, 0.75);

    RANGE.targetDistances.forEach((distance, index) => {
      const z = -distance;

      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(24, 0.4), stripeMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.03, z);
      this.add(stripe, { collider: false, shadow: false });

      const texture = createSignTexture(`${distance} m`);
      const signMaterial = new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide });
      for (const side of [-1, 1]) {
        const x = side * 9.3;
        matrix.makeTranslation(x, 1.1, z);
        signPosts.setMatrixAt(index * 2 + (side > 0 ? 1 : 0), matrix);

        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(x, 1.95, z);
        sign.rotation.y = side > 0 ? Math.PI * 0.15 : -Math.PI * 0.15;
        this.add(sign, { collider: false, shadow: false });
      }
    });

    signPosts.instanceMatrix.needsUpdate = true;
    this.group.add(signPosts);
    this.colliders.push(signPosts);
  }
}
