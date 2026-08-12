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

/** A wall run. Doorways punched into it are computed, not hand placed. */
export interface WallSpec {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export const WALL_HEIGHT = 3.6;
export const WALL_THICKNESS = 0.34;

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
