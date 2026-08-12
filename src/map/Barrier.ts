import * as THREE from 'three';
import { damp } from '../utils/math';

export type BarrierKind = 'door' | 'double-door' | 'debris';

export interface BarrierConfig {
  id: string;
  kind: BarrierKind;
  cost: number;
  label: string;
  /** Zone unlocked by opening this barrier. */
  unlocks: string;
  position: THREE.Vector3;
  /** Rotation about Y so the barrier sits in its doorway. */
  rotationY: number;
  width: number;
  height: number;
}

const OPEN_SPEED = 2.2;

/**
 * A paid barrier: a door, a pair of doors, or a pile of debris. Closed
 * barriers block bullets, players and zombie navigation alike; opening one is
 * permanent and shared by the whole squad.
 */
export class Barrier {
  readonly group = new THREE.Group();
  readonly config: BarrierConfig;
  /** Meshes that should stop bullets while the barrier is closed. */
  readonly colliders: THREE.Object3D[] = [];

  private readonly panels: THREE.Object3D[] = [];
  private opened = false;
  /** 0 closed, 1 fully open; drives the animation. */
  private progress = 0;

  constructor(config: BarrierConfig, materials: { panel: THREE.Material; frame: THREE.Material }) {
    this.config = config;
    this.group.position.copy(config.position);
    this.group.rotation.y = config.rotationY;

    const { width, height, kind } = config;

    // Frame is permanent: it stays after the barrier clears.
    const frameThickness = 0.12;
    const jamb = new THREE.BoxGeometry(frameThickness, height + 0.1, 0.3);
    const left = new THREE.Mesh(jamb, materials.frame);
    left.position.set(-width / 2 - frameThickness / 2, height / 2, 0);
    const right = new THREE.Mesh(jamb, materials.frame);
    right.position.set(width / 2 + frameThickness / 2, height / 2, 0);
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(width + frameThickness * 2, frameThickness, 0.3),
      materials.frame,
    );
    lintel.position.set(0, height + frameThickness / 2, 0);
    this.group.add(left, right, lintel);

    if (kind === 'debris') {
      // A stack of tumbled slabs that sinks into the floor when cleared.
      for (let i = 0; i < 5; i++) {
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(width * (0.55 + Math.random() * 0.4), 0.22, 0.34),
          materials.panel,
        );
        slab.position.set(
          (Math.random() - 0.5) * width * 0.3,
          0.16 + i * 0.24,
          (Math.random() - 0.5) * 0.16,
        );
        slab.rotation.set(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.35,
        );
        slab.castShadow = true;
        this.panels.push(slab);
        this.group.add(slab);
      }
    } else {
      const leaves = kind === 'double-door' ? 2 : 1;
      const leafWidth = width / leaves;
      for (let i = 0; i < leaves; i++) {
        // Each leaf pivots on its own hinge so it can swing.
        const hinge = new THREE.Group();
        const sign = leaves === 1 ? -1 : i === 0 ? -1 : 1;
        hinge.position.set(sign * (width / 2), 0, 0);

        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(leafWidth, height, 0.09),
          materials.panel,
        );
        leaf.position.set(-sign * (leafWidth / 2), height / 2, 0);
        leaf.castShadow = true;
        hinge.add(leaf);
        hinge.userData.swing = -sign * 1.9;
        this.panels.push(hinge);
        this.group.add(hinge);
      }
    }

    for (const panel of this.panels) {
      panel.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) this.colliders.push(object);
      });
    }
  }

  get id(): string {
    return this.config.id;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Starts the opening animation. Returns false if already open. */
  open(): boolean {
    if (this.opened) return false;
    this.opened = true;
    return true;
  }

  /** Opens with no animation, used when joining a match in progress. */
  openInstantly(): void {
    this.opened = true;
    this.progress = 1;
    this.applyProgress();
    this.hideColliders();
  }

  update(dt: number): void {
    if (!this.opened || this.progress >= 1) return;
    this.progress = damp(this.progress, 1, OPEN_SPEED, dt);
    if (this.progress > 0.995) {
      this.progress = 1;
      this.hideColliders();
    }
    this.applyProgress();
  }

  dispose(): void {
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    this.group.removeFromParent();
    this.colliders.length = 0;
  }

  private applyProgress(): void {
    for (const panel of this.panels) {
      const swing = panel.userData.swing as number | undefined;
      if (swing !== undefined) {
        panel.rotation.y = swing * this.progress;
      } else {
        // Debris drops away and fades under the floor.
        panel.position.y -= 0;
        panel.scale.setScalar(Math.max(0.001, 1 - this.progress));
      }
    }
  }

  private hideColliders(): void {
    for (const panel of this.panels) panel.visible = this.config.kind !== 'debris';
    this.colliders.length = 0;
  }
}
