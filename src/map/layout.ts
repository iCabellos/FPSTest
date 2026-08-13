/**
 * Declarative floor plan for the mansion.
 *
 * This is the single source of truth: geometry, player collision and zombie
 * navigation are all derived from it. The previous map hand placed walls and
 * waypoints separately, so they disagreed — zombies walked through walls and
 * the player hit walls that were not there. Deriving everything from one
 * description makes that class of bug impossible.
 *
 * The site is deliberately flat and fully enclosed: one storey, a sealed
 * perimeter, and no holes to fall through.
 */

import type { WeaponId } from '../weapons/WeaponDefinition';

export interface RoomSpec {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Floor treatment, which also sets the mood of the room. */
  floor: FloorStyle;
  /** Extra navigation nodes, as fractions of the room, for wider coverage. */
  patrol?: ReadonlyArray<readonly [number, number]>;
}

export type FloorStyle = 'parquet' | 'tile' | 'carpet' | 'concrete' | 'marble';

export interface DoorwaySpec {
  id: string;
  /** Rooms this doorway joins. */
  between: readonly [string, string];
  /** Centre of the opening. */
  x: number;
  z: number;
  /** Opening runs along this axis. */
  axis: 'x' | 'z';
  width: number;
  /** Null when the doorway is always open. */
  barrier: BarrierSpec | null;
}

export interface BarrierSpec {
  cost: number;
  label: string;
  kind: 'door' | 'double-door' | 'debris';
}

/**
 * A boarded window in an exterior wall. Zombies spawn on the lawn, walk to a
 * window, tear the boards off and climb in; the sill is solid, so the player
 * can never walk out of one.
 */
export interface WindowSpec {
  id: string;
  /** Room the window opens into. */
  room: string;
  /** Centre of the opening, on the wall line. */
  x: number;
  z: number;
  /** Opening runs along this axis. */
  axis: 'x' | 'z';
  width: number;
  /** Unit step from the wall toward the lawn. */
  outward: readonly [number, number];
}

/** A wall run. Doorways punched into it are computed, not hand placed. */
export interface WallSpec {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/** Wall mounted purchase point: a weapon on the wall, or an ammo crate. */
export interface WallBuySpec {
  id: string;
  room: string;
  /** Which of the room's four walls it hangs on. */
  side: 'north' | 'south' | 'east' | 'west';
  /** Position along that wall, as a fraction from its low corner. */
  along: number;
  kind: 'weapon' | 'ammo';
  /** Set for weapon buys. */
  weapon?: WeaponId;
  cost: number;
  /** Cost to top the weapon up once you already carry it. */
  refillCost: number;
}

export const WALL_HEIGHT = 3.6;
export const WALL_THICKNESS = 0.34;

/** Bottom and top of a window opening. */
export const WINDOW_SILL = 1.05;
export const WINDOW_HEAD = 2.5;
/** Planks nailed across each window; a zombie pulls one off at a time. */
export const WINDOW_BOARDS = 4;

/** Outer shell, as a closed loop so the building cannot leak. */
export const PERIMETER: readonly WallSpec[] = [
  { x1: -18, z1: 14, x2: 18, z2: 14 },
  { x1: 18, z1: 14, x2: 18, z2: -22 },
  { x1: 18, z1: -22, x2: -18, z2: -22 },
  { x1: -18, z1: -22, x2: -18, z2: 14 },
];

/** Interior partitions. Doorways are cut from these by the builder. */
export const PARTITIONS: readonly WallSpec[] = [
  // Foyer walls, framing the entrance.
  { x1: -6, z1: 7, x2: 6, z2: 7 },
  { x1: -6, z1: 7, x2: -6, z2: 14 },
  { x1: 6, z1: 7, x2: 6, z2: 14 },
  // Great hall side walls.
  { x1: -6, z1: -4, x2: -6, z2: 7 },
  { x1: 6, z1: -4, x2: 6, z2: 7 },
  { x1: -6, z1: -4, x2: 6, z2: -4 },
  // West and east wings, split front to back.
  { x1: -18, z1: 0, x2: -6, z2: 0 },
  { x1: 18, z1: 0, x2: 6, z2: 0 },
  // Gallery side walls.
  { x1: -6, z1: -14, x2: -6, z2: -4 },
  { x1: 6, z1: -14, x2: 6, z2: -4 },
  // Back wall onto the vault.
  { x1: -18, z1: -14, x2: 18, z2: -14 },
];

export const ROOMS: readonly RoomSpec[] = [
  {
    id: 'foyer',
    name: 'Foyer',
    minX: -6,
    maxX: 6,
    minZ: 7,
    maxZ: 14,
    floor: 'marble',
    patrol: [
      [0.2, 0.5],
      [0.8, 0.5],
    ],
  },
  {
    id: 'hall',
    name: 'Great Hall',
    minX: -6,
    maxX: 6,
    minZ: -4,
    maxZ: 7,
    floor: 'parquet',
    patrol: [
      [0.25, 0.3],
      [0.75, 0.3],
      [0.5, 0.75],
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    minX: -18,
    maxX: -6,
    minZ: 0,
    maxZ: 14,
    floor: 'tile',
    patrol: [
      [0.3, 0.25],
      [0.7, 0.7],
    ],
  },
  {
    id: 'library',
    name: 'Library',
    minX: 6,
    maxX: 18,
    minZ: 0,
    maxZ: 14,
    floor: 'carpet',
    patrol: [
      [0.3, 0.3],
      [0.7, 0.7],
    ],
  },
  {
    id: 'dining',
    name: 'Dining Room',
    minX: -18,
    maxX: -6,
    minZ: -14,
    maxZ: 0,
    floor: 'parquet',
    patrol: [
      [0.3, 0.3],
      [0.7, 0.7],
    ],
  },
  {
    id: 'study',
    name: 'Study',
    minX: 6,
    maxX: 18,
    minZ: -14,
    maxZ: 0,
    floor: 'carpet',
    patrol: [
      [0.3, 0.3],
      [0.7, 0.7],
    ],
  },
  {
    id: 'gallery',
    name: 'Gallery',
    minX: -6,
    maxX: 6,
    minZ: -14,
    maxZ: -4,
    floor: 'marble',
    patrol: [
      [0.5, 0.3],
      [0.5, 0.7],
    ],
  },
  {
    id: 'vault',
    name: 'Vault',
    minX: -18,
    maxX: 18,
    minZ: -22,
    maxZ: -14,
    floor: 'concrete',
    patrol: [
      [0.2, 0.5],
      [0.5, 0.5],
      [0.8, 0.5],
    ],
  },
];

/**
 * Doorways, with the costs that gate progress. Several are free so the map
 * has loops rather than one corridor: you can always circle back.
 */
export const DOORWAYS: readonly DoorwaySpec[] = [
  { id: 'foyer-hall', between: ['foyer', 'hall'], x: 0, z: 7, axis: 'x', width: 3.4, barrier: null },
  {
    id: 'kitchen',
    between: ['hall', 'kitchen'],
    x: -6,
    z: 4,
    axis: 'z',
    width: 3,
    barrier: { cost: 750, label: 'KITCHEN', kind: 'door' },
  },
  {
    id: 'library',
    between: ['hall', 'library'],
    x: 6,
    z: 4,
    axis: 'z',
    width: 3,
    barrier: { cost: 750, label: 'LIBRARY', kind: 'door' },
  },
  {
    id: 'gallery',
    between: ['hall', 'gallery'],
    x: 0,
    z: -4,
    axis: 'x',
    width: 3.4,
    barrier: { cost: 1250, label: 'GALLERY', kind: 'double-door' },
  },
  {
    id: 'dining',
    between: ['kitchen', 'dining'],
    x: -13,
    z: 0,
    axis: 'x',
    width: 3,
    barrier: { cost: 1000, label: 'DINING ROOM', kind: 'door' },
  },
  {
    id: 'study',
    between: ['library', 'study'],
    x: 13,
    z: 0,
    axis: 'x',
    width: 3,
    barrier: { cost: 1000, label: 'STUDY', kind: 'door' },
  },
  // Free side doors, so cleared wings loop back into the gallery.
  {
    id: 'dining-gallery',
    between: ['dining', 'gallery'],
    x: -6,
    z: -9,
    axis: 'z',
    width: 2.6,
    barrier: null,
  },
  {
    id: 'study-gallery',
    between: ['study', 'gallery'],
    x: 6,
    z: -9,
    axis: 'z',
    width: 2.6,
    barrier: null,
  },
  {
    id: 'vault',
    between: ['gallery', 'vault'],
    x: 0,
    z: -14,
    axis: 'x',
    width: 4,
    barrier: { cost: 2000, label: 'VAULT', kind: 'debris' },
  },
];

/**
 * Windows, all in exterior walls. Their placement decides the whole difficulty
 * curve: the free starting area only touches the outside along the foyer's
 * front wall, so round one always comes through those two windows. Buying a
 * door opens that wing's windows as new lanes at the same time as it opens the
 * route, which is why the map gets harder as it gets bigger.
 */
export const WINDOWS: readonly WindowSpec[] = [
  // Foyer, the starting room: the only lane available on round one.
  { id: 'foyer-w', room: 'foyer', x: -3.6, z: 14, axis: 'x', width: 1.7, outward: [0, 1] },
  { id: 'foyer-e', room: 'foyer', x: 3.6, z: 14, axis: 'x', width: 1.7, outward: [0, 1] },
  // Kitchen, west wing.
  { id: 'kitchen-n', room: 'kitchen', x: -12, z: 14, axis: 'x', width: 1.7, outward: [0, 1] },
  { id: 'kitchen-w1', room: 'kitchen', x: -18, z: 9, axis: 'z', width: 1.7, outward: [-1, 0] },
  { id: 'kitchen-w2', room: 'kitchen', x: -18, z: 3.5, axis: 'z', width: 1.7, outward: [-1, 0] },
  // Library, east wing.
  { id: 'library-n', room: 'library', x: 12, z: 14, axis: 'x', width: 1.7, outward: [0, 1] },
  { id: 'library-e1', room: 'library', x: 18, z: 9, axis: 'z', width: 1.7, outward: [1, 0] },
  { id: 'library-e2', room: 'library', x: 18, z: 3.5, axis: 'z', width: 1.7, outward: [1, 0] },
  // Dining room and study, mid depth.
  { id: 'dining-w1', room: 'dining', x: -18, z: -4, axis: 'z', width: 1.7, outward: [-1, 0] },
  { id: 'dining-w2', room: 'dining', x: -18, z: -10, axis: 'z', width: 1.7, outward: [-1, 0] },
  { id: 'study-e1', room: 'study', x: 18, z: -4, axis: 'z', width: 1.7, outward: [1, 0] },
  { id: 'study-e2', room: 'study', x: 18, z: -10, axis: 'z', width: 1.7, outward: [1, 0] },
  // Vault, the deepest room, and the most exposed.
  { id: 'vault-s1', room: 'vault', x: -9, z: -22, axis: 'x', width: 1.7, outward: [0, -1] },
  { id: 'vault-s2', room: 'vault', x: 0, z: -22, axis: 'x', width: 1.7, outward: [0, -1] },
  { id: 'vault-s3', room: 'vault', x: 9, z: -22, axis: 'x', width: 1.7, outward: [0, -1] },
  { id: 'vault-w', room: 'vault', x: -18, z: -18, axis: 'z', width: 1.7, outward: [-1, 0] },
  { id: 'vault-e', room: 'vault', x: 18, z: -18, axis: 'z', width: 1.7, outward: [1, 0] },
];

/**
 * Wall buys. Prices climb with how deep the room is, so the arsenal unlocks
 * in step with the doors. The special weapon hangs in the vault, the last room
 * on the route, and is the single most expensive thing in the mansion.
 */
export const WALL_BUYS: readonly WallBuySpec[] = [
  { id: 'wall-m1911', room: 'foyer', side: 'west', along: 0.5, kind: 'weapon', weapon: 'm1911', cost: 500, refillCost: 250 },
  { id: 'wall-mp5', room: 'hall', side: 'east', along: 0.2, kind: 'weapon', weapon: 'mp5', cost: 1000, refillCost: 450 },
  { id: 'ammo-hall', room: 'hall', side: 'west', along: 0.2, kind: 'ammo', cost: 650, refillCost: 650 },
  { id: 'wall-ak47', room: 'kitchen', side: 'north', along: 0.15, kind: 'weapon', weapon: 'ak47', cost: 1800, refillCost: 600 },
  { id: 'ammo-kitchen', room: 'kitchen', side: 'south', along: 0.72, kind: 'ammo', cost: 650, refillCost: 650 },
  { id: 'wall-m4a1', room: 'library', side: 'north', along: 0.85, kind: 'weapon', weapon: 'm4a1', cost: 1800, refillCost: 600 },
  { id: 'ammo-library', room: 'library', side: 'south', along: 0.28, kind: 'ammo', cost: 650, refillCost: 650 },
  { id: 'wall-ump45', room: 'dining', side: 'west', along: 0.5, kind: 'weapon', weapon: 'ump45', cost: 1400, refillCost: 500 },
  { id: 'wall-mp7', room: 'study', side: 'east', along: 0.5, kind: 'weapon', weapon: 'mp7', cost: 1600, refillCost: 550 },
  { id: 'wall-uzi', room: 'kitchen', side: 'south', along: 0.16, kind: 'weapon', weapon: 'uzi', cost: 1200, refillCost: 500 },
  { id: 'wall-r870', room: 'dining', side: 'south', along: 0.3, kind: 'weapon', weapon: 'r870', cost: 1500, refillCost: 600 },
  { id: 'wall-g36', room: 'study', side: 'south', along: 0.3, kind: 'weapon', weapon: 'g36', cost: 1900, refillCost: 650 },
  { id: 'wall-deagle', room: 'gallery', side: 'south', along: 0.1, kind: 'weapon', weapon: 'deagle', cost: 1700, refillCost: 600 },
  { id: 'ammo-gallery', room: 'gallery', side: 'west', along: 0.15, kind: 'ammo', cost: 650, refillCost: 650 },
  { id: 'wall-m60', room: 'gallery', side: 'east', along: 0.15, kind: 'weapon', weapon: 'm60', cost: 2600, refillCost: 900 },
  { id: 'wall-l96', room: 'vault', side: 'west', along: 0.85, kind: 'weapon', weapon: 'l96', cost: 2000, refillCost: 700 },
  { id: 'ammo-vault', room: 'vault', side: 'north', along: 0.16, kind: 'ammo', cost: 650, refillCost: 650 },
  // The special weapon: last room, on the wall, and priced accordingly.
  { id: 'wall-special', room: 'vault', side: 'south', along: 0.375, kind: 'weapon', weapon: 'slotmachine', cost: 4000, refillCost: 1500 },
];

/**
 * Rooms the mystery box can land in. The free starting area (foyer and great
 * hall) is excluded so the box always costs a door to reach.
 */
export const BOX_ROOMS: readonly string[] = ['kitchen', 'library', 'dining', 'study', 'gallery', 'vault'];

/** Where the player starts: just inside the front door. */
export const PLAYER_SPAWN = { x: 0, z: 11.5 };

export function roomById(id: string): RoomSpec {
  const room = ROOMS.find((candidate) => candidate.id === id);
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}

export function roomCentre(room: RoomSpec): { x: number; z: number } {
  return { x: (room.minX + room.maxX) / 2, z: (room.minZ + room.maxZ) / 2 };
}

/** True when the point is inside the room, ignoring wall thickness. */
export function isInsideRoom(room: RoomSpec, x: number, z: number): boolean {
  return x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ;
}

/** The room containing a point, or null when outside the building. */
export function roomAt(x: number, z: number): RoomSpec | null {
  return ROOMS.find((room) => isInsideRoom(room, x, z)) ?? null;
}

/** A spot on a room's wall, with the direction that faces into the room. */
export interface WallMount {
  x: number;
  z: number;
  /** Unit vector pointing away from the wall, into the room. */
  inwardX: number;
  inwardZ: number;
  /** Yaw that turns an object's +Z toward the room. */
  rotationY: number;
}

/**
 * Resolves a `(room, side, along)` triple into a world spot on that wall.
 * Derived rather than hand placed, so a wall buy can never end up floating in
 * mid air or buried inside a wall when the plan changes.
 */
export function wallMount(room: RoomSpec, side: WallBuySpec['side'], along: number): WallMount {
  const fraction = Math.min(1, Math.max(0, along));
  const inset = WALL_THICKNESS / 2;
  switch (side) {
    case 'north':
      return {
        x: room.minX + (room.maxX - room.minX) * fraction,
        z: room.maxZ - inset,
        inwardX: 0,
        inwardZ: -1,
        rotationY: Math.PI,
      };
    case 'south':
      return {
        x: room.minX + (room.maxX - room.minX) * fraction,
        z: room.minZ + inset,
        inwardX: 0,
        inwardZ: 1,
        rotationY: 0,
      };
    case 'east':
      return {
        x: room.maxX - inset,
        z: room.minZ + (room.maxZ - room.minZ) * fraction,
        inwardX: -1,
        inwardZ: 0,
        rotationY: -Math.PI / 2,
      };
    default:
      return {
        x: room.minX + inset,
        z: room.minZ + (room.maxZ - room.minZ) * fraction,
        inwardX: 1,
        inwardZ: 0,
        rotationY: Math.PI / 2,
      };
  }
}
