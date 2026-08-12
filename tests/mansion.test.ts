import { describe, expect, it } from 'vitest';
import { cutDoorways } from '../src/map/Mansion';
import {
  DOORWAYS,
  PARTITIONS,
  PERIMETER,
  PLAYER_SPAWN,
  ROOMS,
  isInsideRoom,
  roomAt,
  roomById,
  roomCentre,
  type WallSpec,
} from '../src/map/layout';

/** Total solid length left in a run after its doorways are cut out. */
function solidLength(wall: WallSpec): number {
  return cutDoorways(wall, DOORWAYS).reduce(
    (total, piece) => total + Math.abs(piece.x2 - piece.x1) + Math.abs(piece.z2 - piece.z1),
    0,
  );
}

function wallLength(wall: WallSpec): number {
  return Math.abs(wall.x2 - wall.x1) + Math.abs(wall.z2 - wall.z1);
}

describe('doorway cutting', () => {
  it('leaves a run untouched when nothing crosses it', () => {
    const wall: WallSpec = { x1: -5, z1: 3, x2: 5, z2: 3 };
    expect(cutDoorways(wall, [])).toEqual([{ x1: -5, z1: 3, x2: 5, z2: 3 }]);
  });

  it('splits a run into two pieces around an opening', () => {
    const wall: WallSpec = { x1: -5, z1: 0, x2: 5, z2: 0 };
    const pieces = cutDoorways(wall, [
      { id: 'd', between: ['a', 'b'], x: 0, z: 0, axis: 'x', width: 2, barrier: null },
    ]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toEqual({ x1: -5, z1: 0, x2: -1, z2: 0 });
    expect(pieces[1]).toEqual({ x1: 1, z1: 0, x2: 5, z2: 0 });
  });

  it('ignores doorways that belong to a different wall', () => {
    const wall: WallSpec = { x1: -5, z1: 0, x2: 5, z2: 0 };
    // Same line position but on z = 4, so it must not punch this run.
    const pieces = cutDoorways(wall, [
      { id: 'd', between: ['a', 'b'], x: 0, z: 4, axis: 'x', width: 2, barrier: null },
    ]);
    expect(pieces).toHaveLength(1);
  });

  it('ignores doorways beyond the ends of the run', () => {
    const wall: WallSpec = { x1: 0, z1: 0, x2: 5, z2: 0 };
    const pieces = cutDoorways(wall, [
      { id: 'd', between: ['a', 'b'], x: 9, z: 0, axis: 'x', width: 2, barrier: null },
    ]);
    expect(pieces).toHaveLength(1);
  });

  it('cuts vertical runs the same way', () => {
    const wall: WallSpec = { x1: 3, z1: -6, x2: 3, z2: 6 };
    const pieces = cutDoorways(wall, [
      { id: 'd', between: ['a', 'b'], x: 3, z: 0, axis: 'z', width: 4, barrier: null },
    ]);
    expect(pieces).toEqual([
      { x1: 3, z1: -6, x2: 3, z2: -2 },
      { x1: 3, z1: 2, x2: 3, z2: 6 },
    ]);
  });
});

describe('floor plan', () => {
  it('never punches a hole in the outer shell', () => {
    // Every doorway is interior, so the perimeter must survive intact.
    for (const wall of PERIMETER) {
      expect(solidLength(wall)).toBeCloseTo(wallLength(wall), 6);
    }
  });

  it('closes the perimeter into a loop', () => {
    for (let i = 0; i < PERIMETER.length; i++) {
      const current = PERIMETER[i];
      const next = PERIMETER[(i + 1) % PERIMETER.length];
      expect([current.x2, current.z2]).toEqual([next.x1, next.z1]);
    }
  });

  it('gives every doorway a wall to sit in', () => {
    for (const doorway of DOORWAYS) {
      const host = PARTITIONS.some((wall) => {
        const horizontal = Math.abs(wall.x2 - wall.x1) > Math.abs(wall.z2 - wall.z1);
        const fixed = horizontal ? wall.z1 : wall.x1;
        const doorFixed = horizontal ? doorway.z : doorway.x;
        const along = horizontal ? doorway.x : doorway.z;
        const start = horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.z1, wall.z2);
        const end = horizontal ? Math.max(wall.x1, wall.x2) : Math.max(wall.z1, wall.z2);
        return Math.abs(doorFixed - fixed) < 0.01 && along > start && along < end;
      });
      expect(host, doorway.id).toBe(true);
    }
  });

  it('joins rooms that actually exist and are neighbours', () => {
    for (const doorway of DOORWAYS) {
      const [a, b] = doorway.between.map((id) => roomById(id));
      // The opening has to lie on the shared edge of the two rooms.
      const touching =
        Math.abs(a.maxX - b.minX) < 0.01 ||
        Math.abs(b.maxX - a.minX) < 0.01 ||
        Math.abs(a.maxZ - b.minZ) < 0.01 ||
        Math.abs(b.maxZ - a.minZ) < 0.01;
      expect(touching, doorway.id).toBe(true);
    }
  });

  it('does not overlap rooms', () => {
    for (let i = 0; i < ROOMS.length; i++) {
      for (let j = i + 1; j < ROOMS.length; j++) {
        const a = ROOMS[i];
        const b = ROOMS[j];
        const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
        const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
        expect(overlapX > 0.01 && overlapZ > 0.01, `${a.id}/${b.id}`).toBe(false);
      }
    }
  });

  it('keeps every room inside the perimeter', () => {
    for (const room of ROOMS) {
      expect(room.minX, room.id).toBeGreaterThanOrEqual(-18);
      expect(room.maxX, room.id).toBeLessThanOrEqual(18);
      expect(room.minZ, room.id).toBeGreaterThanOrEqual(-22);
      expect(room.maxZ, room.id).toBeLessThanOrEqual(14);
    }
  });

  it('spawns the player on solid floor inside a room', () => {
    const room = roomAt(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    expect(room).not.toBeNull();
    expect(room!.id).toBe('foyer');
  });

  it('puts every patrol point inside its own room', () => {
    for (const room of ROOMS) {
      for (const [fx, fz] of room.patrol ?? []) {
        const x = room.minX + (room.maxX - room.minX) * fx;
        const z = room.minZ + (room.maxZ - room.minZ) * fz;
        expect(isInsideRoom(room, x, z), `${room.id} ${fx},${fz}`).toBe(true);
      }
    }
  });

  it('places every room centre on solid floor', () => {
    for (const room of ROOMS) {
      const centre = roomCentre(room);
      expect(roomAt(centre.x, centre.z)?.id, room.id).toBe(room.id);
    }
  });

  it('reaches every room from the entrance once its barriers are paid', () => {
    // Walk the doorway graph with everything open; nothing may be stranded.
    const reached = new Set<string>(['foyer']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const doorway of DOORWAYS) {
        const [a, b] = doorway.between;
        if (reached.has(a) && !reached.has(b)) {
          reached.add(b);
          grew = true;
        } else if (reached.has(b) && !reached.has(a)) {
          reached.add(a);
          grew = true;
        }
      }
    }
    for (const room of ROOMS) expect(reached.has(room.id), room.id).toBe(true);
  });

  it('locks everything past the first two rooms behind a price', () => {
    const free = DOORWAYS.filter((doorway) => doorway.barrier === null);
    // The foyer opens onto the hall for free; the rest of the free doors are
    // loop backs between rooms that are already paid for.
    expect(free.some((doorway) => doorway.id === 'foyer-hall')).toBe(true);
    for (const doorway of DOORWAYS) {
      if (!doorway.barrier) continue;
      expect(doorway.barrier.cost, doorway.id).toBeGreaterThan(0);
    }
  });

  it('offers a loop rather than a single corridor', () => {
    // More doorways than rooms minus one means at least one cycle exists.
    expect(DOORWAYS.length).toBeGreaterThan(ROOMS.length - 1);
  });
});
