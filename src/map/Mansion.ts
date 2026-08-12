import * as THREE from 'three';
import type { BoxObstacle } from '../range/ShootingRange';
import { Barrier, type BarrierConfig } from './Barrier';
import {
  DOORWAYS,
  PARTITIONS,
  PERIMETER,
  PLAYER_SPAWN,
  ROOMS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  roomAt,
  roomCentre,
  type DoorwaySpec,
  type WallSpec,
} from './layout';
import { NavGraph } from './NavGraph';
import { createFloorTexture, createWallTexture } from './textures';

/** Segment of wall left after doorways are cut out of a run. */
interface WallPiece {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

const CEILING_Y = WALL_HEIGHT;

/**
 * The mansion: one flat, fully enclosed storey generated from
 * {@link ROOMS}, {@link PARTITIONS} and {@link DOORWAYS}.
 *
 * Geometry, player collision and the navigation graph are all built from that
 * same plan, so a wall always blocks what it looks like it blocks and a
 * navigation edge always follows a real opening.
 */
export class Mansion {
  readonly group = new THREE.Group();
  readonly colliders: THREE.Object3D[] = [];
  readonly obstacles: BoxObstacle[] = [];
  readonly barriers: Barrier[] = [];
  readonly nav = new NavGraph(256);
  readonly playerSpawn = new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
  /** Nodes zombies enter from, one per room, away from the entrance. */
  readonly spawnNodes: number[] = [];

  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly barrierById = new Map<string, Barrier>();
  private readonly roomNodes = new Map<string, number>();

  constructor(scene: THREE.Scene) {
    const wallMaterial = this.material(
      new THREE.MeshLambertMaterial({ map: this.texture(createWallTexture()) }),
    );
    const trimMaterial = this.material(new THREE.MeshLambertMaterial({ color: 0x2b2f36 }));
    const ceilingMaterial = this.material(new THREE.MeshLambertMaterial({ color: 0x1b1f25 }));

    this.buildGround();
    this.buildFloors();
    this.buildCeiling(ceilingMaterial);
    this.buildWalls(wallMaterial);
    this.buildBarriers({ panel: trimMaterial, frame: trimMaterial });
    this.buildNavigation();

    scene.add(this.group);
  }

  /** The map is flat, so the walkable height is always the ground. */
  get floorHeight(): number {
    return 0;
  }

  isBarrierOpen = (id: string): boolean => this.barrierById.get(id)?.isOpen ?? true;

  barrier(id: string): Barrier | undefined {
    return this.barrierById.get(id);
  }

  /** Colliders that currently stop bullets, including closed barriers. */
  collectColliders(target: THREE.Object3D[]): THREE.Object3D[] {
    target.length = 0;
    target.push(...this.colliders);
    for (const barrier of this.barriers) {
      if (!barrier.isOpen) target.push(...barrier.colliders);
    }
    return target;
  }

  /** Blockers the player collides with: walls plus every shut barrier. */
  collectObstacles(target: BoxObstacle[]): BoxObstacle[] {
    target.length = 0;
    target.push(...this.obstacles);
    for (const barrier of this.barriers) {
      if (barrier.isOpen) continue;
      const box = this.barrierBox(barrier.id);
      if (box) target.push(box);
    }
    return target;
  }

  update(dt: number): void {
    for (const barrier of this.barriers) barrier.update(dt);
  }

  dispose(): void {
    for (const barrier of this.barriers) barrier.dispose();
    this.barriers.length = 0;
    this.barrierById.clear();
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.materials.length = 0;
    this.textures.length = 0;
    this.group.removeFromParent();
    this.colliders.length = 0;
    this.obstacles.length = 0;
  }

  // ---------------------------------------------------------------- geometry

  private material<T extends THREE.Material>(value: T): T {
    this.materials.push(value);
    return value;
  }

  private texture(value: THREE.Texture): THREE.Texture {
    this.textures.push(value);
    return value;
  }

  private buildGround(): void {
    // Grounds the building in a site rather than floating in the void.
    const groundMaterial = this.material(
      new THREE.MeshLambertMaterial({ map: this.texture(createFloorTexture('concrete', 40)) }),
    );
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.colliders.push(ground);
  }

  /** One slab per room, each with the flooring that fits the room. */
  private buildFloors(): void {
    for (const room of ROOMS) {
      const width = room.maxX - room.minX;
      const depth = room.maxZ - room.minZ;
      const material = this.material(
        new THREE.MeshLambertMaterial({
          map: this.texture(createFloorTexture(room.floor, Math.max(width, depth) / 2.4)),
        }),
      );
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(room.minX + width / 2, 0, room.minZ + depth / 2);
      slab.receiveShadow = true;
      slab.matrixAutoUpdate = false;
      slab.updateMatrix();
      this.group.add(slab);
      this.colliders.push(slab);
    }
  }

  private buildCeiling(material: THREE.Material): void {
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), material);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, CEILING_Y, -4);
    ceiling.matrixAutoUpdate = false;
    ceiling.updateMatrix();
    this.group.add(ceiling);
    this.colliders.push(ceiling);
  }

  /**
   * Turns every wall run into solid pieces, cutting a gap wherever a doorway
   * crosses it. Rendering and collision come from the same pieces.
   */
  private buildWalls(material: THREE.Material): void {
    for (const wall of [...PERIMETER, ...PARTITIONS]) {
      for (const piece of cutDoorways(wall, DOORWAYS)) this.addWallPiece(piece, material);
    }
  }

  private addWallPiece(piece: WallPiece, material: THREE.Material): void {
    const horizontal = Math.abs(piece.x2 - piece.x1) > Math.abs(piece.z2 - piece.z1);
    const length = horizontal ? Math.abs(piece.x2 - piece.x1) : Math.abs(piece.z2 - piece.z1);
    if (length < 0.05) return;

    const width = horizontal ? length : WALL_THICKNESS;
    const depth = horizontal ? WALL_THICKNESS : length;
    const x = (piece.x1 + piece.x2) / 2;
    const z = (piece.z1 + piece.z2) / 2;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), material);
    mesh.position.set(x, WALL_HEIGHT / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    this.colliders.push(mesh);

    this.obstacles.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    });
  }

  private buildBarriers(materials: { panel: THREE.Material; frame: THREE.Material }): void {
    for (const doorway of DOORWAYS) {
      if (!doorway.barrier) continue;
      const config: BarrierConfig = {
        id: doorway.id,
        kind: doorway.barrier.kind,
        cost: doorway.barrier.cost,
        label: doorway.barrier.label,
        unlocks: doorway.between[1],
        position: new THREE.Vector3(doorway.x, 0, doorway.z),
        // A doorway lying along X needs a barrier facing across it.
        rotationY: doorway.axis === 'x' ? 0 : Math.PI / 2,
        width: doorway.width,
        height: WALL_HEIGHT - 0.6,
      };
      const barrier = new Barrier(config, materials);
      this.barriers.push(barrier);
      this.barrierById.set(config.id, barrier);
      this.group.add(barrier.group);
    }
  }

  /** Player sized blocker filling a shut doorway. */
  private barrierBox(id: string): BoxObstacle | null {
    const doorway = DOORWAYS.find((candidate) => candidate.id === id);
    if (!doorway) return null;
    const half = doorway.width / 2;
    if (doorway.axis === 'x') {
      return {
        minX: doorway.x - half,
        maxX: doorway.x + half,
        minZ: doorway.z - WALL_THICKNESS / 2,
        maxZ: doorway.z + WALL_THICKNESS / 2,
      };
    }
    return {
      minX: doorway.x - WALL_THICKNESS / 2,
      maxX: doorway.x + WALL_THICKNESS / 2,
      minZ: doorway.z - half,
      maxZ: doorway.z + half,
    };
  }

  /**
   * Navigation derived from the plan: a node at each room centre, extra patrol
   * nodes inside the room, and a node in each doorway joining the two rooms.
   * Because doorway nodes come from the same list that cuts the walls, a route
   * can only ever pass through a real opening.
   */
  private buildNavigation(): void {
    for (const room of ROOMS) {
      const centre = roomCentre(room);
      const id = this.nav.addNode(new THREE.Vector3(centre.x, 0, centre.z), room.id);
      this.roomNodes.set(room.id, id);

      let furthest = id;
      let furthestDistance = 0;
      for (const [fx, fz] of room.patrol ?? []) {
        const x = room.minX + (room.maxX - room.minX) * fx;
        const z = room.minZ + (room.maxZ - room.minZ) * fz;
        const patrolId = this.nav.addNode(new THREE.Vector3(x, 0, z), room.id);
        this.nav.connect(id, patrolId);

        const distance = Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z);
        if (distance > furthestDistance) {
          furthestDistance = distance;
          furthest = patrolId;
        }
      }
      // Zombies come in from the far corner of each room.
      this.spawnNodes.push(furthest);
    }

    for (const doorway of DOORWAYS) {
      const node = this.nav.addNode(new THREE.Vector3(doorway.x, 0, doorway.z), doorway.id);
      const gate = doorway.barrier ? doorway.id : null;
      for (const roomId of doorway.between) {
        const roomNode = this.roomNodes.get(roomId);
        if (roomNode === undefined) continue;
        this.nav.connect(node, roomNode, gate);
      }
    }
  }
}

/**
 * Splits a wall run wherever a doorway crosses it, returning the solid pieces
 * either side. A doorway counts as crossing when it lies on the run's line and
 * within its extent.
 */
export function cutDoorways(
  wall: WallSpec,
  doorways: readonly DoorwaySpec[],
): readonly WallPiece[] {
  const horizontal = Math.abs(wall.x2 - wall.x1) > Math.abs(wall.z2 - wall.z1);
  const start = horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.z1, wall.z2);
  const end = horizontal ? Math.max(wall.x1, wall.x2) : Math.max(wall.z1, wall.z2);
  const fixed = horizontal ? wall.z1 : wall.x1;

  // Openings along this run, as [from, to] spans.
  const gaps: Array<[number, number]> = [];
  for (const doorway of doorways) {
    const doorFixed = horizontal ? doorway.z : doorway.x;
    const doorAlong = horizontal ? doorway.x : doorway.z;
    if (Math.abs(doorFixed - fixed) > 0.01) continue;
    if (doorAlong <= start || doorAlong >= end) continue;
    gaps.push([doorAlong - doorway.width / 2, doorAlong + doorway.width / 2]);
  }
  gaps.sort((a, b) => a[0] - b[0]);

  const pieces: WallPiece[] = [];
  let cursor = start;
  for (const [from, to] of gaps) {
    if (from > cursor) pieces.push(makePiece(horizontal, fixed, cursor, from));
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) pieces.push(makePiece(horizontal, fixed, cursor, end));
  return pieces;
}

function makePiece(horizontal: boolean, fixed: number, from: number, to: number): WallPiece {
  return horizontal
    ? { x1: from, z1: fixed, x2: to, z2: fixed }
    : { x1: fixed, z1: from, x2: fixed, z2: to };
}

export { roomAt, ROOMS };
