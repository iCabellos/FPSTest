import * as THREE from 'three';
import {
  DOORWAYS,
  PERIMETER,
  ROOMS,
  WINDOWS,
  WINDOW_SILL,
  roomCentre,
  type WindowSpec,
} from './layout';
import type { NavGraph } from './NavGraph';

/** How far outside the walls the zombies' approach ring runs. */
export const APPROACH_OFFSET = 2.6;
/** How far out the lawn they appear on sits. */
export const LAWN_OFFSET = 8;

const HOUSE = {
  minX: Math.min(...PERIMETER.map((wall) => Math.min(wall.x1, wall.x2))),
  maxX: Math.max(...PERIMETER.map((wall) => Math.max(wall.x1, wall.x2))),
  minZ: Math.min(...PERIMETER.map((wall) => Math.min(wall.z1, wall.z2))),
  maxZ: Math.max(...PERIMETER.map((wall) => Math.max(wall.z1, wall.z2))),
};
const HOUSE_CENTRE = { x: (HOUSE.minX + HOUSE.maxX) / 2, z: (HOUSE.minZ + HOUSE.maxZ) / 2 };

export interface MansionNavigation {
  /** Centre node per room, by room id. */
  roomNodes: Map<string, number>;
  /** Lawn nodes the horde walks in from. All are outside the building. */
  spawnNodes: number[];
  /** Sill node per window, by window id. */
  windowNodes: Map<string, number>;
}

/**
 * Builds the whole navigation graph from the floor plan.
 *
 * Kept apart from the mesh building so the routes can be checked without a
 * renderer: it is the part where a mistake is invisible on screen and fatal in
 * play, so it has to be testable on its own.
 *
 * The shape of it:
 * - a node at each room centre plus its patrol points;
 * - a node in each doorway, gated by that doorway's barrier;
 * - a node in each window sill, raised to sill height and marked as a climb;
 * - a ring of approach nodes hugging the outside walls;
 * - a lawn beyond that, which is where zombies are spawned.
 *
 * The only edges that cross the shell are the window ones, so a walker can
 * only ever get inside by climbing through a window — that is a property of
 * the graph, not of any behaviour written on top of it.
 */
export function buildMansionNavigation(nav: NavGraph): MansionNavigation {
  const roomNodes = new Map<string, number>();
  const roomNodeLists = new Map<string, number[]>();
  const windowNodes = new Map<string, number>();
  const spawnNodes: number[] = [];

  for (const room of ROOMS) {
    const centre = roomCentre(room);
    const id = nav.addNode(new THREE.Vector3(centre.x, 0, centre.z), room.id);
    roomNodes.set(room.id, id);

    const list = [id];
    for (const [fx, fz] of room.patrol ?? []) {
      const x = room.minX + (room.maxX - room.minX) * fx;
      const z = room.minZ + (room.maxZ - room.minZ) * fz;
      const patrolId = nav.addNode(new THREE.Vector3(x, 0, z), room.id);
      nav.connect(id, patrolId);
      list.push(patrolId);
    }
    roomNodeLists.set(room.id, list);
  }

  for (const doorway of DOORWAYS) {
    const node = nav.addNode(new THREE.Vector3(doorway.x, 0, doorway.z), doorway.id);
    const gate = doorway.barrier ? doorway.id : null;
    for (const roomId of doorway.between) {
      const roomNode = roomNodes.get(roomId);
      if (roomNode === undefined) continue;
      nav.connect(node, roomNode, gate);
    }
  }

  const approach: number[] = [];
  for (const spec of WINDOWS) {
    // The sill sits at sill height, so a walker following it rises as it
    // arrives and drops back once inside: the climb falls out of the geometry
    // rather than being animated separately.
    const sill = nav.addNode(new THREE.Vector3(spec.x, WINDOW_SILL, spec.z), spec.id, true);
    windowNodes.set(spec.id, sill);

    const outside = nav.addNode(
      new THREE.Vector3(
        spec.x + spec.outward[0] * APPROACH_OFFSET,
        0,
        spec.z + spec.outward[1] * APPROACH_OFFSET,
      ),
      `approach:${spec.id}`,
    );
    // One way in: climbing through a window is not a route back out.
    nav.connectOneWay(outside, sill);
    approach.push(outside);

    // Link the sill to whichever node in that room is genuinely closest, so a
    // walker heads into the room rather than across it.
    const inside = nearestRoomNode(nav, roomNodeLists.get(spec.room) ?? [], spec);
    if (inside !== null) nav.connectOneWay(sill, inside);
  }

  buildExteriorRing(nav, approach, spawnNodes);
  return { roomNodes, spawnNodes, windowNodes };
}

function nearestRoomNode(
  nav: NavGraph,
  candidates: readonly number[],
  spec: WindowSpec,
): number | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const id of candidates) {
    const node = nav.node(id);
    const distance = (node.position.x - spec.x) ** 2 + (node.position.z - spec.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}

/**
 * Closes the approach nodes into a ring around the house and hangs the lawn
 * spawn points off it. Sorting by bearing about the centre of a convex
 * building puts the ring in perimeter order, so consecutive links always run
 * alongside a wall and never cut through the building.
 */
function buildExteriorRing(nav: NavGraph, approach: number[], spawnNodes: number[]): void {
  const ring = [...approach];
  for (const [x, z] of [
    [HOUSE.minX - APPROACH_OFFSET, HOUSE.maxZ + APPROACH_OFFSET],
    [HOUSE.maxX + APPROACH_OFFSET, HOUSE.maxZ + APPROACH_OFFSET],
    [HOUSE.maxX + APPROACH_OFFSET, HOUSE.minZ - APPROACH_OFFSET],
    [HOUSE.minX - APPROACH_OFFSET, HOUSE.minZ - APPROACH_OFFSET],
  ]) {
    ring.push(nav.addNode(new THREE.Vector3(x, 0, z), 'outside'));
  }

  const bearing = (id: number): number => {
    const node = nav.node(id);
    return Math.atan2(node.position.z - HOUSE_CENTRE.z, node.position.x - HOUSE_CENTRE.x);
  };
  ring.sort((a, b) => bearing(a) - bearing(b));
  for (let i = 0; i < ring.length; i++) nav.connect(ring[i], ring[(i + 1) % ring.length]);

  // The lawn: far enough out that the horde is never seen appearing.
  for (const [x, z] of [
    [HOUSE.minX - LAWN_OFFSET, HOUSE.maxZ + LAWN_OFFSET],
    [HOUSE_CENTRE.x, HOUSE.maxZ + LAWN_OFFSET],
    [HOUSE.maxX + LAWN_OFFSET, HOUSE.maxZ + LAWN_OFFSET],
    [HOUSE.maxX + LAWN_OFFSET, HOUSE_CENTRE.z],
    [HOUSE.maxX + LAWN_OFFSET, HOUSE.minZ - LAWN_OFFSET],
    [HOUSE_CENTRE.x, HOUSE.minZ - LAWN_OFFSET],
    [HOUSE.minX - LAWN_OFFSET, HOUSE.minZ - LAWN_OFFSET],
    [HOUSE.minX - LAWN_OFFSET, HOUSE_CENTRE.z],
  ]) {
    const lawn = nav.addNode(new THREE.Vector3(x, 0, z), 'lawn');
    nav.connect(lawn, nearestOf(nav, ring, x, z));
    spawnNodes.push(lawn);
  }
}

function nearestOf(nav: NavGraph, ids: readonly number[], x: number, z: number): number {
  let best = ids[0];
  let bestDistance = Infinity;
  for (const id of ids) {
    const node = nav.node(id);
    const distance = (node.position.x - x) ** 2 + (node.position.z - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}
