import * as THREE from 'three';
import type { BoxObstacle } from '../range/ShootingRange';
import type { RandomSource } from '../utils/Random';
import { WEAPONS_BY_ID } from '../weapons/definitions';
import {
  createWeaponMaterials,
  disposeWeaponMaterials,
  type WeaponMaterials,
} from '../weapons/viewmodel/WeaponModelFactory';
import { Barrier, type BarrierConfig } from './Barrier';
import { MansionWindow } from './MansionWindow';
import { WallBuy } from './WallBuy';
import {
  BOX_ROOMS,
  DOORWAYS,
  PARTITIONS,
  PERIMETER,
  PLAYER_SPAWN,
  ROOMS,
  WALL_BUYS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WINDOWS,
  WINDOW_HEAD,
  WINDOW_SILL,
  roomAt,
  roomById,
  roomCentre,
  wallMount,
  type DoorwaySpec,
  type WallSpec,
  type WindowSpec,
} from './layout';
import { buildMansionNavigation } from './navigation';
import { NavGraph } from './NavGraph';
import { createFloorTexture, createWallTexture } from './textures';

/**
 * Segment of wall left after doorways and windows are cut out of a run. The
 * vertical extent matters: a window leaves a solid sill below it and a solid
 * header above it, both of which are still real geometry.
 */
export interface WallPiece {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  y1: number;
  y2: number;
}

const CEILING_Y = WALL_HEIGHT;

/**
 * The mansion: one flat, fully enclosed storey generated from
 * {@link ROOMS}, {@link PARTITIONS}, {@link DOORWAYS} and {@link WINDOWS}.
 *
 * Geometry, player collision and the navigation graph are all built from that
 * same plan, so a wall always blocks what it looks like it blocks and a
 * navigation edge always follows a real opening. The only routes in from
 * outside are the windows, and the only routes deeper in are the doorways.
 */
export class Mansion {
  readonly group = new THREE.Group();
  readonly colliders: THREE.Object3D[] = [];
  readonly obstacles: BoxObstacle[] = [];
  readonly barriers: Barrier[] = [];
  readonly windows: MansionWindow[] = [];
  readonly wallBuys: WallBuy[] = [];
  readonly nav = new NavGraph(384);
  readonly playerSpawn = new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
  /** Lawn nodes zombies walk on from; all of them are outside the building. */
  readonly spawnNodes: number[] = [];
  /** Where the mystery box landed this match. */
  readonly boxRoom: string;
  readonly boxPosition = new THREE.Vector3();

  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly weaponMaterials: WeaponMaterials = createWeaponMaterials();
  private readonly barrierById = new Map<string, Barrier>();
  private readonly windowById = new Map<string, MansionWindow>();
  private elapsed = 0;

  constructor(scene: THREE.Scene, random: RandomSource = Math.random) {
    const wallMaterial = this.material(
      new THREE.MeshLambertMaterial({ map: this.texture(createWallTexture()) }),
    );
    const trimMaterial = this.material(new THREE.MeshLambertMaterial({ color: 0x2b2f36 }));
    const ceilingMaterial = this.material(new THREE.MeshLambertMaterial({ color: 0x1b1f25 }));
    const boardMaterial = this.material(new THREE.MeshLambertMaterial({ color: 0x6b4b2a }));

    this.buildGround();
    this.buildFloors();
    this.buildCeiling(ceilingMaterial);
    this.buildWalls(wallMaterial);
    this.buildWindows({ board: boardMaterial, frame: trimMaterial });
    this.buildBarriers({ panel: trimMaterial, frame: trimMaterial });
    this.buildWallBuys();

    const navigation = buildMansionNavigation(this.nav);
    this.spawnNodes.push(...navigation.spawnNodes);

    const box = pickBoxRoom(random);
    this.boxRoom = box.room;
    this.boxPosition.set(box.x, 0, box.z);
    // The crate is solid: you walk around it, not through it.
    this.obstacles.push({
      minX: box.x - 0.72,
      maxX: box.x + 0.72,
      minZ: box.z - 0.52,
      maxZ: box.z + 0.52,
    });

    scene.add(this.group);
  }

  /** The map is flat, so the walkable height is always the ground. */
  get floorHeight(): number {
    return 0;
  }

  isBarrierOpen = (id: string): boolean => this.barrierById.get(id)?.isOpen ?? true;

  /** True when the nav zone is a window that still has planks across it. */
  isEntryBoarded = (zone: string): boolean => this.windowById.get(zone)?.isBoarded ?? false;

  /** Pulls one plank off a window. @returns true when one came away. */
  tearEntry = (zone: string): boolean => this.windowById.get(zone)?.tearBoard() ?? false;

  barrier(id: string): Barrier | undefined {
    return this.barrierById.get(id);
  }

  window(id: string): MansionWindow | undefined {
    return this.windowById.get(id);
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

  update(dt: number, highlightedBuy: string | null = null): void {
    this.elapsed += dt;
    for (const barrier of this.barriers) barrier.update(dt);
    for (const buy of this.wallBuys) buy.update(dt, buy.id === highlightedBuy, this.elapsed);
  }

  dispose(): void {
    for (const barrier of this.barriers) barrier.dispose();
    for (const window of this.windows) window.dispose();
    for (const buy of this.wallBuys) buy.dispose();
    this.barriers.length = 0;
    this.windows.length = 0;
    this.wallBuys.length = 0;
    this.barrierById.clear();
    this.windowById.clear();
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    disposeWeaponMaterials(this.weaponMaterials);
    this.materials.length = 0;
    this.textures.length = 0;
    this.group.removeFromParent();
    this.colliders.length = 0;
    this.obstacles.length = 0;
  }

  /** Shared weapon materials, so props elsewhere reuse one set. */
  get propMaterials(): WeaponMaterials {
    return this.weaponMaterials;
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
    // Grounds the building in a site rather than floating in the void, and
    // gives the horde somewhere real to walk in from.
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
   * Turns every wall run into solid pieces.
   *
   * The two cuts do different jobs and are deliberately kept apart. Doorways
   * are cut from the footprint, so they let the player and bullets through.
   * Windows are then cut out of each footprint piece vertically, so they let
   * bullets and zombies through while the solid sill below still blocks the
   * player: the collision box comes from before the window cut, the meshes
   * from after it.
   */
  private buildWalls(material: THREE.Material): void {
    for (const wall of [...PERIMETER, ...PARTITIONS]) {
      for (const footprint of cutDoorways(wall, DOORWAYS)) {
        this.addObstacle(footprint);
        for (const piece of cutWindows(footprint, WINDOWS)) this.addWallMesh(piece, material);
      }
    }
  }

  private addObstacle(piece: WallPiece): void {
    const { x, z, width, depth, length } = pieceBounds(piece);
    if (length < 0.05) return;
    this.obstacles.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    });
  }

  private addWallMesh(piece: WallPiece, material: THREE.Material): void {
    const { x, z, width, depth, length } = pieceBounds(piece);
    const height = piece.y2 - piece.y1;
    if (length < 0.05 || height < 0.02) return;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, piece.y1 + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    this.colliders.push(mesh);
  }

  private buildWindows(materials: { board: THREE.Material; frame: THREE.Material }): void {
    for (const spec of WINDOWS) {
      const window = new MansionWindow(
        {
          id: spec.id,
          room: spec.room,
          position: new THREE.Vector3(spec.x, 0, spec.z),
          axis: spec.axis,
          width: spec.width,
          outward: new THREE.Vector3(spec.outward[0], 0, spec.outward[1]),
        },
        materials,
      );
      this.windows.push(window);
      this.windowById.set(spec.id, window);
      this.group.add(window.group);
    }
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

  private buildWallBuys(): void {
    for (const spec of WALL_BUYS) {
      const mount = wallMount(roomById(spec.room), spec.side, spec.along);
      const weapon = spec.weapon ? WEAPONS_BY_ID[spec.weapon] : null;
      const buy = new WallBuy(spec, mount, weapon, this.weaponMaterials);
      this.wallBuys.push(buy);
      this.group.add(buy.group);
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

}

function pieceBounds(piece: WallPiece): {
  x: number;
  z: number;
  width: number;
  depth: number;
  length: number;
} {
  const horizontal = Math.abs(piece.x2 - piece.x1) > Math.abs(piece.z2 - piece.z1);
  const length = horizontal ? Math.abs(piece.x2 - piece.x1) : Math.abs(piece.z2 - piece.z1);
  return {
    x: (piece.x1 + piece.x2) / 2,
    z: (piece.z1 + piece.z2) / 2,
    width: horizontal ? length : WALL_THICKNESS,
    depth: horizontal ? WALL_THICKNESS : length,
    length,
  };
}

/** Picks the room the mystery box lands in, and a clear spot inside it. */
export function pickBoxRoom(random: RandomSource = Math.random): {
  room: string;
  x: number;
  z: number;
} {
  const index = Math.min(BOX_ROOMS.length - 1, Math.floor(random() * BOX_ROOMS.length));
  const room = roomById(BOX_ROOMS[index]);
  const centre = roomCentre(room);
  // Offset toward a corner so the box is not standing in the doorway lane.
  return {
    room: room.id,
    x: centre.x + (room.maxX - room.minX) * 0.22,
    z: centre.z + (room.maxZ - room.minZ) * 0.22,
  };
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

/**
 * Cuts window openings out of a wall piece, vertically.
 *
 * Each window leaves four solids: the wall either side of it, the sill under
 * it and the header over it. Because only the meshes are cut this way, the
 * hole is see-through and shoot-through while the player's collision box for
 * this run stays whole.
 */
export function cutWindows(
  piece: WallPiece,
  windows: readonly WindowSpec[],
): readonly WallPiece[] {
  const horizontal = Math.abs(piece.x2 - piece.x1) > Math.abs(piece.z2 - piece.z1);
  const start = horizontal ? Math.min(piece.x1, piece.x2) : Math.min(piece.z1, piece.z2);
  const end = horizontal ? Math.max(piece.x1, piece.x2) : Math.max(piece.z1, piece.z2);
  const fixed = horizontal ? piece.z1 : piece.x1;

  const gaps: Array<[number, number]> = [];
  for (const window of windows) {
    const windowFixed = horizontal ? window.z : window.x;
    const windowAlong = horizontal ? window.x : window.z;
    if (Math.abs(windowFixed - fixed) > 0.01) continue;
    const from = windowAlong - window.width / 2;
    const to = windowAlong + window.width / 2;
    if (to <= start || from >= end) continue;
    gaps.push([Math.max(start, from), Math.min(end, to)]);
  }
  if (gaps.length === 0) return [piece];
  gaps.sort((a, b) => a[0] - b[0]);

  const pieces: WallPiece[] = [];
  let cursor = start;
  for (const [from, to] of gaps) {
    if (from > cursor) {
      pieces.push(makePiece(horizontal, fixed, cursor, from, piece.y1, piece.y2));
    }
    // Sill under the opening and header over it, both full thickness.
    pieces.push(makePiece(horizontal, fixed, from, to, piece.y1, Math.min(piece.y2, WINDOW_SILL)));
    pieces.push(makePiece(horizontal, fixed, from, to, Math.max(piece.y1, WINDOW_HEAD), piece.y2));
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) pieces.push(makePiece(horizontal, fixed, cursor, end, piece.y1, piece.y2));
  return pieces.filter((candidate) => candidate.y2 - candidate.y1 > 0.02);
}

function makePiece(
  horizontal: boolean,
  fixed: number,
  from: number,
  to: number,
  y1 = 0,
  y2 = WALL_HEIGHT,
): WallPiece {
  return horizontal
    ? { x1: from, z1: fixed, x2: to, z2: fixed, y1, y2 }
    : { x1: fixed, z1: from, x2: fixed, z2: to, y1, y2 };
}

export { roomAt, ROOMS };
