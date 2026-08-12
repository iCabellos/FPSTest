import * as THREE from 'three';
import type { BoxObstacle } from '../range/ShootingRange';
import type { GroundSampler } from '../player/Player';
import { PLAYER } from '../core/constants';
import { createNoiseTexture } from '../rendering/textures';
import { Barrier, type BarrierConfig } from './Barrier';
import { NavGraph } from './NavGraph';

/** Storey heights. Three interior floors plus the roof terrace. */
export const FLOOR_Y = [0, 4.2, 8.4, 12.6] as const;

interface Surface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  /** Set for ramps: height at maxZ (or maxX) when the surface slopes. */
  yHigh?: number;
  along?: 'x' | 'z';
}

const HALF_W = 17;
const HALF_D = 13;
const WALL_H = 3.4;

/**
 * Procedural modern mansion: three interior storeys and a roof terrace,
 * connected by ramped staircases. Rooms are laid out for zombie gameplay —
 * loops, a couple of choke points and several defendable corners — and each
 * area past the entry is gated by a paid barrier.
 */
export class Mansion implements GroundSampler {
  readonly group = new THREE.Group();
  /** Everything bullets can hit. */
  readonly colliders: THREE.Object3D[] = [];
  /** Axis aligned blockers for player movement. */
  readonly obstacles: BoxObstacle[] = [];
  readonly barriers: Barrier[] = [];
  readonly nav = new NavGraph(320);
  readonly playerSpawn = new THREE.Vector3(0, FLOOR_Y[0], HALF_D - 3);
  readonly packAPunchPosition = new THREE.Vector3(0, FLOOR_Y[3], -6);

  /** Zombie spawn nodes, grouped by the zone that must be open. */
  readonly spawnNodes: number[] = [];

  private readonly surfaces: Surface[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly barrierById = new Map<string, Barrier>();

  constructor(scene: THREE.Scene) {
    const concrete = this.material(new THREE.MeshLambertMaterial({
      map: createNoiseTexture('#d8d6d0', 10, 6),
    }));
    const floorMaterial = this.material(new THREE.MeshLambertMaterial({
      map: createNoiseTexture('#8d8a85', 12, 10),
    }));
    const accent = this.material(new THREE.MeshLambertMaterial({ color: 0x3a3f45 }));
    const glass = this.material(new THREE.MeshPhongMaterial({
      color: 0x9fc4dd,
      transparent: true,
      opacity: 0.22,
      shininess: 90,
    }));
    const panel = this.material(new THREE.MeshLambertMaterial({ color: 0x6c7176 }));

    this.buildShell(concrete, floorMaterial, glass);
    this.buildFloorOne(concrete, accent);
    this.buildFloorTwo(concrete, accent);
    this.buildFloorThree(concrete, accent);
    this.buildTerrace(concrete, accent);
    this.buildBarriers({ panel, frame: accent });
    this.buildNavigation();

    scene.add(this.group);
  }

  // ---------------------------------------------------------------- surfaces

  /** Highest floor at or just above the walker's feet; null when out of bounds. */
  sampleHeight(x: number, z: number, currentY: number): number | null {
    let best: number | null = null;
    let lowest: number | null = null;
    const ceiling = currentY + PLAYER.stepHeight;

    for (const surface of this.surfaces) {
      if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) continue;
      const height = surfaceHeight(surface, x, z);
      if (lowest === null || height < lowest) lowest = height;
      if (height <= ceiling && (best === null || height > best)) best = height;
    }
    return best ?? lowest;
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
    this.materials.length = 0;
    this.group.removeFromParent();
    this.colliders.length = 0;
    this.obstacles.length = 0;
  }

  // ---------------------------------------------------------------- building

  private material<T extends THREE.Material>(value: T): T {
    this.materials.push(value);
    return value;
  }

  /** Solid box that blocks bullets and movement. */
  private wall(
    material: THREE.Material,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y + height / 2, z);
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
    return mesh;
  }

  /** Walkable slab: renders, blocks bullets and registers as standable. */
  private slab(
    material: THREE.Material,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    y: number,
  ): void {
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), material);
    mesh.position.set(minX + width / 2, y - 0.15, minZ + depth / 2);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    this.colliders.push(mesh);
    this.surfaces.push({ minX, maxX, minZ, maxZ, y });
  }

  /** Ramped staircase with visual treads. Ramps avoid step climbing logic. */
  private stair(
    material: THREE.Material,
    accent: THREE.Material,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    yLow: number,
    yHigh: number,
  ): void {
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const rise = yHigh - yLow;
    const length = Math.hypot(depth, rise);

    const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, length), material);
    ramp.position.set(minX + width / 2, yLow + rise / 2 - 0.12, minZ + depth / 2);
    ramp.rotation.x = -Math.atan2(rise, depth);
    ramp.receiveShadow = true;
    this.group.add(ramp);
    this.colliders.push(ramp);

    // Treads, purely visual, instanced so the detail is one draw call.
    const steps = Math.max(6, Math.round(rise / 0.19));
    const tread = new THREE.InstancedMesh(
      new THREE.BoxGeometry(width * 0.98, 0.05, depth / steps),
      accent,
      steps,
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      matrix.makeTranslation(
        minX + width / 2,
        yLow + rise * t + 0.02,
        minZ + depth * t,
      );
      tread.setMatrixAt(i, matrix);
    }
    tread.instanceMatrix.needsUpdate = true;
    this.group.add(tread);

    this.surfaces.push({ minX, maxX, minZ, maxZ, y: yLow, yHigh, along: 'z' });
  }

  private buildShell(
    concrete: THREE.Material,
    floorMaterial: THREE.Material,
    glass: THREE.Material,
  ): void {
    // Ground plane around the building so falling off has somewhere to land.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.colliders.push(ground);

    for (let level = 0; level < FLOOR_Y.length; level++) {
      const y = FLOOR_Y[level];
      // Perimeter walls. The terrace gets a low parapet instead.
      const height = level === 3 ? 1.15 : WALL_H;
      this.wall(concrete, HALF_W * 2, height, 0.4, 0, y, -HALF_D);
      this.wall(concrete, HALF_W * 2, height, 0.4, 0, y, HALF_D);
      this.wall(concrete, 0.4, height, HALF_D * 2, -HALF_W, y, 0);
      this.wall(concrete, 0.4, height, HALF_D * 2, HALF_W, y, 0);
    }

    // Floor slabs with a void where the stairwell passes through.
    for (let level = 0; level < FLOOR_Y.length; level++) {
      const y = FLOOR_Y[level];
      this.slab(floorMaterial, -HALF_W, HALF_W, -HALF_D, 4, y);
      this.slab(floorMaterial, -HALF_W, 4, 4, HALF_D, y);
      // Right hand strip is the stairwell: only the landing is solid.
      this.slab(floorMaterial, 4, HALF_W, 10, HALF_D, y);
    }

    // Full height glazing on the long faces: modern, and keeps sight lines.
    for (let level = 0; level < 3; level++) {
      const y = FLOOR_Y[level];
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 - 1, WALL_H - 0.6), glass);
      pane.position.set(0, y + WALL_H / 2, -HALF_D + 0.25);
      this.group.add(pane);
    }
  }

  private buildFloorOne(concrete: THREE.Material, accent: THREE.Material): void {
    const y = FLOOR_Y[0];
    // Entry hall divider with the doorway to the lounge.
    this.wall(concrete, 9, WALL_H, 0.3, -12, y, 4);
    this.wall(concrete, 9, WALL_H, 0.3, 8, y, 4);
    // Kitchen block.
    this.wall(concrete, 0.3, WALL_H, 9, -6, y, -8);
    this.wall(concrete, 7, WALL_H, 0.3, -12, y, -4);
    // Dining counter, low cover in the open plan area.
    this.wall(accent, 6, 1.05, 0.7, 6, y, -4);
    this.stair(concrete, accent, 6, 12, 4, 12, FLOOR_Y[0], FLOOR_Y[1]);
  }

  private buildFloorTwo(concrete: THREE.Material, accent: THREE.Material): void {
    const y = FLOOR_Y[1];
    // Corridor spine with two bedrooms off it.
    this.wall(concrete, 0.3, WALL_H, 12, -2, y, -6);
    this.wall(concrete, 10, WALL_H, 0.3, -11, y, -2);
    this.wall(concrete, 0.3, WALL_H, 8, -11, y, -9);
    // Open mezzanine railing over the entry.
    this.wall(accent, 12, 1.05, 0.25, 8, y, 3.5);
    this.stair(concrete, accent, 6, 12, 4, 12, FLOOR_Y[1], FLOOR_Y[2]);
  }

  private buildFloorThree(concrete: THREE.Material, accent: THREE.Material): void {
    const y = FLOOR_Y[2];
    // One big combat hall with a couple of columns for cover and loops.
    this.wall(concrete, 0.3, WALL_H, 10, 0, y, -7);
    this.wall(accent, 1, WALL_H, 1, -9, y, -6);
    this.wall(accent, 1, WALL_H, 1, -9, y, 1);
    this.stair(concrete, accent, 6, 12, 4, 12, FLOOR_Y[2], FLOOR_Y[3]);
  }

  private buildTerrace(concrete: THREE.Material, accent: THREE.Material): void {
    const y = FLOOR_Y[3];
    // Pergola frame around the Pack-a-Punch, plus a windbreak.
    this.wall(accent, 0.3, 2.6, 0.3, -3, y, -9);
    this.wall(accent, 0.3, 2.6, 0.3, 3, y, -9);
    this.wall(accent, 0.3, 2.6, 0.3, -3, y, -3);
    this.wall(accent, 0.3, 2.6, 0.3, 3, y, -3);
    this.wall(concrete, 8, 1.4, 0.3, -10, y, -6);
  }

  private buildBarriers(materials: { panel: THREE.Material; frame: THREE.Material }): void {
    const configs: BarrierConfig[] = [
      {
        id: 'lounge',
        kind: 'door',
        cost: 750,
        label: 'LOUNGE',
        unlocks: 'lounge',
        position: new THREE.Vector3(-3.5, FLOOR_Y[0], 4),
        rotationY: 0,
        width: 2.4,
        height: 2.6,
      },
      {
        id: 'kitchen',
        kind: 'double-door',
        cost: 1000,
        label: 'KITCHEN',
        unlocks: 'kitchen',
        position: new THREE.Vector3(-6, FLOOR_Y[0], -2),
        rotationY: Math.PI / 2,
        width: 2.8,
        height: 2.6,
      },
      {
        id: 'stair-a',
        kind: 'debris',
        cost: 1250,
        label: 'STAIRWELL',
        unlocks: 'stair-a',
        position: new THREE.Vector3(9, FLOOR_Y[0], 4.2),
        rotationY: 0,
        width: 5.6,
        height: 2.8,
      },
      {
        id: 'bedrooms',
        kind: 'double-door',
        cost: 1500,
        label: 'BEDROOMS',
        unlocks: 'bedrooms',
        position: new THREE.Vector3(-6, FLOOR_Y[1], -2),
        rotationY: 0,
        width: 2.8,
        height: 2.6,
      },
      {
        id: 'stair-b',
        kind: 'debris',
        cost: 1750,
        label: 'UPPER STAIRS',
        unlocks: 'stair-b',
        position: new THREE.Vector3(9, FLOOR_Y[1], 4.2),
        rotationY: 0,
        width: 5.6,
        height: 2.8,
      },
      {
        id: 'loft',
        kind: 'door',
        cost: 2000,
        label: 'LOFT',
        unlocks: 'loft',
        position: new THREE.Vector3(0, FLOOR_Y[2], -1.6),
        rotationY: Math.PI / 2,
        width: 2.6,
        height: 2.6,
      },
      {
        id: 'terrace',
        kind: 'debris',
        cost: 2500,
        label: 'TERRACE',
        unlocks: 'terrace',
        position: new THREE.Vector3(9, FLOOR_Y[2], 4.2),
        rotationY: 0,
        width: 5.6,
        height: 2.8,
      },
    ];

    for (const config of configs) {
      const barrier = new Barrier(config, materials);
      this.barriers.push(barrier);
      this.barrierById.set(config.id, barrier);
      this.group.add(barrier.group);
    }
  }

  /**
   * Waypoint graph. Edges through a doorway carry that barrier's id, so a
   * closed barrier removes the route entirely rather than relying on
   * collision to stop zombies.
   */
  private buildNavigation(): void {
    const nav = this.nav;
    const add = (x: number, y: number, z: number, zone: string): number =>
      nav.addNode(new THREE.Vector3(x, y, z), zone);

    // Floor one.
    const entry = add(0, FLOOR_Y[0], 9, 'entry');
    const entryWest = add(-10, FLOOR_Y[0], 9, 'entry');
    const entryEast = add(11, FLOOR_Y[0], 9, 'entry');
    const loungeDoor = add(-3.5, FLOOR_Y[0], 4, 'entry');
    const lounge = add(-4, FLOOR_Y[0], 0, 'lounge');
    const loungeWest = add(-12, FLOOR_Y[0], 0, 'lounge');
    const loungeNorth = add(-2, FLOOR_Y[0], -8, 'lounge');
    const kitchenDoor = add(-6, FLOOR_Y[0], -2, 'lounge');
    const kitchen = add(-11, FLOOR_Y[0], -7, 'kitchen');
    const kitchenNorth = add(-13, FLOOR_Y[0], -11, 'kitchen');
    const dining = add(7, FLOOR_Y[0], -7, 'lounge');
    const stairADoor = add(9, FLOOR_Y[0], 4.2, 'entry');

    nav.connect(entry, entryWest);
    nav.connect(entry, entryEast);
    nav.connect(entry, loungeDoor);
    nav.connect(loungeDoor, lounge, 'lounge');
    nav.connect(lounge, loungeWest);
    nav.connect(lounge, loungeNorth);
    nav.connect(loungeNorth, dining);
    nav.connect(lounge, kitchenDoor);
    nav.connect(kitchenDoor, kitchen, 'kitchen');
    nav.connect(kitchen, kitchenNorth);
    nav.connect(entryEast, stairADoor);

    // Stairwell up to floor two.
    const stairAMid = add(9, (FLOOR_Y[0] + FLOOR_Y[1]) / 2, 8, 'stair-a');
    const landing2 = add(9, FLOOR_Y[1], 11.5, 'stair-a');
    nav.connect(stairADoor, stairAMid, 'stair-a');
    nav.connect(stairAMid, landing2);

    // Floor two.
    const hall2 = add(4, FLOOR_Y[1], 6, 'stair-a');
    const hall2West = add(-6, FLOOR_Y[1], 6, 'stair-a');
    const mezzanine = add(2, FLOOR_Y[1], 0, 'stair-a');
    const bedroomDoor = add(-6, FLOOR_Y[1], -2, 'stair-a');
    const bedroomA = add(-11, FLOOR_Y[1], -6, 'bedrooms');
    const bedroomB = add(-6, FLOOR_Y[1], -10, 'bedrooms');
    const stairBDoor = add(9, FLOOR_Y[1], 4.2, 'stair-a');

    nav.connect(landing2, hall2);
    nav.connect(hall2, hall2West);
    nav.connect(hall2, mezzanine);
    nav.connect(hall2West, bedroomDoor);
    nav.connect(bedroomDoor, bedroomA, 'bedrooms');
    nav.connect(bedroomA, bedroomB);
    nav.connect(hall2, stairBDoor);

    // Stairwell up to floor three.
    const stairBMid = add(9, (FLOOR_Y[1] + FLOOR_Y[2]) / 2, 8, 'stair-b');
    const landing3 = add(9, FLOOR_Y[2], 11.5, 'stair-b');
    nav.connect(stairBDoor, stairBMid, 'stair-b');
    nav.connect(stairBMid, landing3);

    // Floor three: one open combat hall.
    const hall3 = add(4, FLOOR_Y[2], 6, 'stair-b');
    const loftDoor = add(0, FLOOR_Y[2], -1.6, 'stair-b');
    const loftWest = add(-9, FLOOR_Y[2], -4, 'loft');
    const loftNorth = add(-6, FLOOR_Y[2], -10, 'loft');
    const terraceDoor = add(9, FLOOR_Y[2], 4.2, 'stair-b');

    nav.connect(landing3, hall3);
    nav.connect(hall3, loftDoor);
    nav.connect(loftDoor, loftWest, 'loft');
    nav.connect(loftWest, loftNorth);
    nav.connect(hall3, terraceDoor);

    // Terrace.
    const terraceMid = add(9, (FLOOR_Y[2] + FLOOR_Y[3]) / 2, 8, 'terrace');
    const terrace = add(9, FLOOR_Y[3], 11.5, 'terrace');
    const terraceWest = add(0, FLOOR_Y[3], 2, 'terrace');
    const papNode = add(0, FLOOR_Y[3], -6, 'terrace');
    nav.connect(terraceDoor, terraceMid, 'terrace');
    nav.connect(terraceMid, terrace);
    nav.connect(terrace, terraceWest);
    nav.connect(terraceWest, papNode);

    // Zombies come in from the outer edges of each unlocked area.
    this.spawnNodes.push(
      entryWest,
      entryEast,
      loungeWest,
      loungeNorth,
      kitchenNorth,
      dining,
      bedroomB,
      loftNorth,
      papNode,
    );
  }
}

function surfaceHeight(surface: Surface, x: number, z: number): number {
  if (surface.yHigh === undefined) return surface.y;
  const t =
    surface.along === 'x'
      ? (x - surface.minX) / (surface.maxX - surface.minX)
      : (z - surface.minZ) / (surface.maxZ - surface.minZ);
  return surface.y + (surface.yHigh - surface.y) * Math.min(1, Math.max(0, t));
}
