import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cutWindows, pickBoxRoom, type WallPiece } from '../src/map/Mansion';
import {
  BOX_ROOMS,
  DOORWAYS,
  PERIMETER,
  PLAYER_SPAWN,
  ROOMS,
  WALL_BUYS,
  WALL_HEIGHT,
  WINDOWS,
  WINDOW_HEAD,
  WINDOW_SILL,
  isInsideRoom,
  roomById,
  wallMount,
  type WallSpec,
  type WindowSpec,
} from '../src/map/layout';
import { BOARD_WIDTH } from '../src/map/WallBuy';
import { WEAPONS_BY_ID } from '../src/weapons/definitions';

function fullHeight(wall: WallSpec): WallPiece {
  return { ...wall, y1: 0, y2: WALL_HEIGHT };
}

/** Total wall area left after the cut, ignoring thickness. */
function area(pieces: readonly WallPiece[]): number {
  return pieces.reduce(
    (total, piece) =>
      total +
      (Math.abs(piece.x2 - piece.x1) + Math.abs(piece.z2 - piece.z1)) * (piece.y2 - piece.y1),
    0,
  );
}

describe('window cutting', () => {
  const run: WallSpec = { x1: -6, z1: 4, x2: 6, z2: 4 };
  const window: WindowSpec = {
    id: 'w',
    room: 'r',
    x: 0,
    z: 4,
    axis: 'x',
    width: 2,
    outward: [0, 1],
  };

  it('leaves a run untouched when no window crosses it', () => {
    expect(cutWindows(fullHeight(run), [])).toEqual([fullHeight(run)]);
  });

  it('leaves the wall either side plus a sill and a header', () => {
    const pieces = cutWindows(fullHeight(run), [window]);
    expect(pieces).toHaveLength(4);

    // Full height either side of the opening.
    const sides = pieces.filter((piece) => piece.y1 === 0 && piece.y2 === WALL_HEIGHT);
    expect(sides).toHaveLength(2);

    const sill = pieces.find((piece) => piece.y1 === 0 && piece.y2 === WINDOW_SILL);
    const header = pieces.find((piece) => piece.y1 === WINDOW_HEAD && piece.y2 === WALL_HEIGHT);
    expect(sill).toBeDefined();
    expect(header).toBeDefined();
    // Both span exactly the opening, so the hole is only the glass.
    expect(sill?.x1).toBe(-1);
    expect(sill?.x2).toBe(1);
    expect(header?.x1).toBe(-1);
    expect(header?.x2).toBe(1);
  });

  it('removes exactly the area of the opening', () => {
    const before = area([fullHeight(run)]);
    const after = area(cutWindows(fullHeight(run), [window]));
    expect(before - after).toBeCloseTo(window.width * (WINDOW_HEAD - WINDOW_SILL), 6);
  });

  it('ignores windows that belong to a different wall', () => {
    const elsewhere: WindowSpec = { ...window, z: -9 };
    expect(cutWindows(fullHeight(run), [elsewhere])).toEqual([fullHeight(run)]);
  });

  it('cuts vertical runs the same way', () => {
    const vertical: WallSpec = { x1: 3, z1: -6, x2: 3, z2: 6 };
    const sideWindow: WindowSpec = { ...window, x: 3, z: 0, axis: 'z' };
    const pieces = cutWindows(fullHeight(vertical), [sideWindow]);
    expect(pieces).toHaveLength(4);
    expect(area([fullHeight(vertical)]) - area(pieces)).toBeCloseTo(
      sideWindow.width * (WINDOW_HEAD - WINDOW_SILL),
      6,
    );
  });

  it('leaves the sill solid, so the player still cannot walk out', () => {
    const pieces = cutWindows(fullHeight(run), [window]);
    const acrossTheOpening = pieces.filter(
      (piece) => Math.min(piece.x1, piece.x2) >= -1 && Math.max(piece.x1, piece.x2) <= 1,
    );
    // Something solid covers the floor under the opening.
    expect(acrossTheOpening.some((piece) => piece.y1 === 0 && piece.y2 >= 1)).toBe(true);
  });
});

describe('windows', () => {
  it('are all cut into the outer shell, never an interior partition', () => {
    for (const window of WINDOWS) {
      const onPerimeter = PERIMETER.some((wall) => {
        const horizontal = Math.abs(wall.x2 - wall.x1) > Math.abs(wall.z2 - wall.z1);
        const fixed = horizontal ? wall.z1 : wall.x1;
        const along = horizontal ? window.x : window.z;
        const windowFixed = horizontal ? window.z : window.x;
        const low = horizontal
          ? Math.min(wall.x1, wall.x2)
          : Math.min(wall.z1, wall.z2);
        const high = horizontal
          ? Math.max(wall.x1, wall.x2)
          : Math.max(wall.z1, wall.z2);
        return (
          Math.abs(windowFixed - fixed) < 0.01 &&
          along - window.width / 2 > low &&
          along + window.width / 2 < high
        );
      });
      expect(onPerimeter, window.id).toBe(true);
    }
  });

  it('names a real room and points away from it', () => {
    for (const window of WINDOWS) {
      const room = roomById(window.room);
      const inside = {
        x: window.x - window.outward[0] * 0.6,
        z: window.z - window.outward[1] * 0.6,
      };
      expect(isInsideRoom(room, inside.x, inside.z), window.id).toBe(true);
    }
  });

  it('gives the starting room a way in, so round one can happen at all', () => {
    const foyer = WINDOWS.filter((window) => window.room === 'foyer');
    expect(foyer.length).toBeGreaterThan(0);
  });

  it('opens onto every room that touches the outer shell', () => {
    const shell = {
      minX: Math.min(...PERIMETER.map((wall) => Math.min(wall.x1, wall.x2))),
      maxX: Math.max(...PERIMETER.map((wall) => Math.max(wall.x1, wall.x2))),
      minZ: Math.min(...PERIMETER.map((wall) => Math.min(wall.z1, wall.z2))),
      maxZ: Math.max(...PERIMETER.map((wall) => Math.max(wall.z1, wall.z2))),
    };
    const glazed = new Set(WINDOWS.map((window) => window.room));

    for (const room of ROOMS) {
      const exterior =
        room.minX === shell.minX ||
        room.maxX === shell.maxX ||
        room.minZ === shell.minZ ||
        room.maxZ === shell.maxZ;
      // Rooms on the outside get their own lane in; the two landlocked rooms
      // (the great hall and the gallery) are fed through doorways instead.
      expect(glazed.has(room.id), room.id).toBe(exterior);
    }
  });

  it('has a unique id per window', () => {
    expect(new Set(WINDOWS.map((window) => window.id)).size).toBe(WINDOWS.length);
  });
});

describe('wall buys', () => {
  it('names weapons the game actually has', () => {
    for (const buy of WALL_BUYS) {
      if (buy.kind !== 'weapon') continue;
      expect(buy.weapon, buy.id).toBeDefined();
      expect(WEAPONS_BY_ID[buy.weapon!], buy.id).toBeDefined();
    }
  });

  it('mounts every board inside the room it belongs to', () => {
    for (const buy of WALL_BUYS) {
      const room = roomById(buy.room);
      const mount = wallMount(room, buy.side, buy.along);
      // Half a metre into the room from the board is still inside the room.
      expect(
        isInsideRoom(room, mount.x + mount.inwardX * 0.5, mount.z + mount.inwardZ * 0.5),
        buy.id,
      ).toBe(true);
    }
  });

  it('faces every board into its room', () => {
    for (const buy of WALL_BUYS) {
      const mount = wallMount(roomById(buy.room), buy.side, buy.along);
      // The yaw and the inward vector have to agree, or the chalk faces a wall.
      expect(Math.sin(mount.rotationY), buy.id).toBeCloseTo(mount.inwardX, 6);
      expect(Math.cos(mount.rotationY), buy.id).toBeCloseTo(mount.inwardZ, 6);
    }
  });

  it('sells ammunition in several different rooms', () => {
    const rooms = new Set(WALL_BUYS.filter((buy) => buy.kind === 'ammo').map((buy) => buy.room));
    expect(rooms.size).toBeGreaterThanOrEqual(3);
  });

  it('always costs less to restock than to buy', () => {
    for (const buy of WALL_BUYS) {
      if (buy.kind !== 'weapon') continue;
      expect(buy.refillCost, buy.id).toBeLessThan(buy.cost);
    }
  });

  it('hangs the special weapon in the last room, behind the most doors', () => {
    const special = WALL_BUYS.find((buy) => buy.weapon === 'slotmachine');
    expect(special).toBeDefined();
    expect(special?.room).toBe('vault');
    // And it is the most expensive thing on any wall.
    const dearest = Math.max(...WALL_BUYS.map((buy) => buy.cost));
    expect(special?.cost).toBe(dearest);
  });

  it('gates the vault behind every other purchase', () => {
    const vault = DOORWAYS.find((doorway) => doorway.id === 'vault');
    expect(vault?.barrier).not.toBeNull();
    expect(vault?.between).toContain('vault');
  });

  it('has a unique id per board', () => {
    expect(new Set(WALL_BUYS.map((buy) => buy.id)).size).toBe(WALL_BUYS.length);
  });
});

describe('mystery box placement', () => {
  it('never lands in the free starting area', () => {
    expect(BOX_ROOMS).not.toContain('foyer');
    expect(BOX_ROOMS).not.toContain('hall');
  });

  it('lands inside whichever room it picked, for every room it can pick', () => {
    for (let i = 0; i < BOX_ROOMS.length; i++) {
      // Sample the middle of each slice of the random range.
      const spot = pickBoxRoom(() => (i + 0.5) / BOX_ROOMS.length);
      expect(BOX_ROOMS).toContain(spot.room);
      expect(isInsideRoom(roomById(spot.room), spot.x, spot.z), spot.room).toBe(true);
    }
  });

  it('lands well away from where the player starts', () => {
    for (const room of BOX_ROOMS) {
      const index = BOX_ROOMS.indexOf(room);
      const spot = pickBoxRoom(() => (index + 0.5) / BOX_ROOMS.length);
      const distance = Math.hypot(spot.x - PLAYER_SPAWN.x, spot.z - PLAYER_SPAWN.z);
      expect(distance, room).toBeGreaterThan(6);
    }
  });

  it('stays inside the building', () => {
    const spot = pickBoxRoom(() => 0);
    const position = new THREE.Vector3(spot.x, 0, spot.z);
    expect(Math.abs(position.x)).toBeLessThan(18);
    expect(position.z).toBeLessThan(14);
  });
});

describe('doorways and windows do not collide', () => {
  it('never puts a window where a doorway already is', () => {
    for (const window of WINDOWS) {
      for (const doorway of DOORWAYS) {
        const sameLine =
          Math.abs(window.x - doorway.x) < 0.01 && Math.abs(window.z - doorway.z) < 0.01;
        expect(sameLine, `${window.id}/${doorway.id}`).toBe(false);
      }
    }
  });
});

describe('nothing is mounted over an opening', () => {
  /** The span a board covers along its wall, as [from, to]. */
  function boardSpan(buy: (typeof WALL_BUYS)[number]): {
    fixed: number;
    horizontal: boolean;
    from: number;
    to: number;
  } {
    const mount = wallMount(roomById(buy.room), buy.side, buy.along);
    const horizontal = buy.side === 'north' || buy.side === 'south';
    const along = horizontal ? mount.x : mount.z;
    return {
      horizontal,
      fixed: horizontal ? mount.z : mount.x,
      from: along - BOARD_WIDTH / 2,
      to: along + BOARD_WIDTH / 2,
    };
  }

  function overlaps(a: [number, number], b: [number, number]): boolean {
    return a[0] < b[1] && b[0] < a[1];
  }

  it('never hangs a wall buy across a doorway', () => {
    for (const buy of WALL_BUYS) {
      const board = boardSpan(buy);
      for (const doorway of DOORWAYS) {
        const doorFixed = board.horizontal ? doorway.z : doorway.x;
        const doorAlong = board.horizontal ? doorway.x : doorway.z;
        // Only openings on the same wall line can clash.
        if (Math.abs(doorFixed - board.fixed) > 0.5) continue;
        expect(
          overlaps(
            [board.from, board.to],
            [doorAlong - doorway.width / 2, doorAlong + doorway.width / 2],
          ),
          `${buy.id} over ${doorway.id}`,
        ).toBe(false);
      }
    }
  });

  it('never hangs a wall buy across a window', () => {
    for (const buy of WALL_BUYS) {
      const board = boardSpan(buy);
      for (const window of WINDOWS) {
        const windowFixed = board.horizontal ? window.z : window.x;
        const windowAlong = board.horizontal ? window.x : window.z;
        if (Math.abs(windowFixed - board.fixed) > 0.5) continue;
        expect(
          overlaps(
            [board.from, board.to],
            [windowAlong - window.width / 2, windowAlong + window.width / 2],
          ),
          `${buy.id} over ${window.id}`,
        ).toBe(false);
      }
    }
  });

  it('keeps every board inside the run of wall it hangs on', () => {
    for (const buy of WALL_BUYS) {
      const room = roomById(buy.room);
      const board = boardSpan(buy);
      const low = board.horizontal ? room.minX : room.minZ;
      const high = board.horizontal ? room.maxX : room.maxZ;
      expect(board.from, buy.id).toBeGreaterThanOrEqual(low);
      expect(board.to, buy.id).toBeLessThanOrEqual(high);
    }
  });

  it('never drops the mystery box on top of a wall buy', () => {
    for (let i = 0; i < BOX_ROOMS.length; i++) {
      const spot = pickBoxRoom(() => (i + 0.5) / BOX_ROOMS.length);
      for (const buy of WALL_BUYS.filter((candidate) => candidate.room === spot.room)) {
        const mount = wallMount(roomById(buy.room), buy.side, buy.along);
        expect(Math.hypot(spot.x - mount.x, spot.z - mount.z), buy.id).toBeGreaterThan(1.6);
      }
    }
  });
});
