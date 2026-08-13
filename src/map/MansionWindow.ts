import * as THREE from 'three';
import { WINDOW_BOARDS, WINDOW_HEAD, WINDOW_SILL } from './layout';

export interface WindowConfig {
  id: string;
  /** Room the window opens into. */
  room: string;
  /** Centre of the opening, on the wall line. */
  position: THREE.Vector3;
  axis: 'x' | 'z';
  width: number;
  /** Unit step from the wall toward the lawn. */
  outward: THREE.Vector3;
}

const BOARD_THICKNESS = 0.05;
const BOARD_DEPTH = 0.42;

/**
 * A boarded window: the only way into the mansion.
 *
 * The opening itself is cut out of the wall by the builder, so bullets pass
 * through it while the solid sill underneath still stops the player walking
 * out. The planks across it are what a zombie has to pull off before it can
 * climb in, which is what turns a window into a timed choke point rather than
 * an open door.
 */
export class MansionWindow {
  readonly group = new THREE.Group();
  readonly id: string;
  readonly room: string;
  readonly position: THREE.Vector3;

  private readonly planks: THREE.Mesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private remaining = WINDOW_BOARDS;

  constructor(
    readonly config: WindowConfig,
    materials: { board: THREE.Material; frame: THREE.Material },
  ) {
    this.id = config.id;
    this.room = config.room;
    this.position = config.position.clone();

    // Built along local X and rotated into place, so the plank maths does not
    // have to care which wall this window sits in.
    this.group.position.copy(config.position);
    this.group.rotation.y = config.axis === 'x' ? 0 : Math.PI / 2;

    this.buildFrame(materials.frame);
    this.buildPlanks(materials.board);
    this.group.add(...this.planks);
  }

  get boardsLeft(): number {
    return this.remaining;
  }

  get isBoarded(): boolean {
    return this.remaining > 0;
  }

  /** Pulls the topmost remaining plank off. @returns true when one came away. */
  tearBoard(): boolean {
    if (this.remaining <= 0) return false;
    this.remaining--;
    const plank = this.planks[this.remaining];
    plank.visible = false;
    return true;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    this.planks.length = 0;
    this.group.removeFromParent();
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    this.geometries.push(geometry);
    return new THREE.Mesh(geometry, material);
  }

  private buildFrame(material: THREE.Material): void {
    const height = WINDOW_HEAD - WINDOW_SILL;
    const centreY = (WINDOW_HEAD + WINDOW_SILL) / 2;
    const jamb = 0.08;

    for (const side of [-1, 1]) {
      const post = this.mesh(new THREE.BoxGeometry(jamb, height + jamb * 2, 0.4), material);
      post.position.set(side * (this.config.width / 2 + jamb / 2), centreY, 0);
      this.group.add(post);
    }
    for (const [y, thickness] of [
      [WINDOW_SILL - jamb / 2, 0.1],
      [WINDOW_HEAD + jamb / 2, jamb],
    ] as const) {
      const rail = this.mesh(
        new THREE.BoxGeometry(this.config.width + jamb * 2, thickness, 0.44),
        material,
      );
      rail.position.set(0, y, 0);
      this.group.add(rail);
    }
  }

  /**
   * Planks are spread evenly over the opening and nailed on at alternating
   * angles. They are torn off from the top down, so a half stripped window
   * reads as half stripped from across the room.
   */
  private buildPlanks(material: THREE.Material): void {
    const span = WINDOW_HEAD - WINDOW_SILL;
    const step = span / (WINDOW_BOARDS + 1);
    const length = this.config.width + 0.5;

    for (let i = 0; i < WINDOW_BOARDS; i++) {
      const plank = this.mesh(
        new THREE.BoxGeometry(length, 0.15, BOARD_THICKNESS),
        material,
      );
      plank.position.set(0, WINDOW_SILL + step * (i + 1), BOARD_DEPTH / 2 - 0.18);
      plank.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.05 + (i % 3) * 0.02);
      this.planks.push(plank);
    }
  }
}
