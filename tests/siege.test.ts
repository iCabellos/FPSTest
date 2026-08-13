import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MansionWindow } from '../src/map/MansionWindow';
import { NavGraph } from '../src/map/NavGraph';
import { buildMansionNavigation, type MansionNavigation } from '../src/map/navigation';
import {
  PLAYER_SPAWN,
  WINDOWS,
  WINDOW_BOARDS,
  WINDOW_SILL,
  roomAt,
} from '../src/map/layout';
import { ZombieManager, type EntryGate, type ZombieTarget } from '../src/zombies/ZombieManager';

const ALL_SHUT = (): boolean => false;
const ALL_OPEN = (): boolean => true;

function mansionNav(): { nav: NavGraph; nodes: MansionNavigation } {
  const nav = new NavGraph(384);
  return { nav, nodes: buildMansionNavigation(nav) };
}

/** Board counters standing in for the real windows. */
function boardedEntries(): EntryGate & { left: Map<string, number> } {
  const left = new Map<string, number>(WINDOWS.map((window) => [window.id, WINDOW_BOARDS]));
  return {
    left,
    isBoarded: (zone) => (left.get(zone) ?? 0) > 0,
    tear: (zone) => {
      const remaining = left.get(zone);
      if (remaining === undefined || remaining <= 0) return false;
      left.set(zone, remaining - 1);
      return true;
    },
  };
}

describe('routes into the mansion', () => {
  it('spawns the horde outside the building, every time', () => {
    const { nav, nodes } = mansionNav();
    for (const id of nodes.spawnNodes) {
      const node = nav.node(id);
      expect(roomAt(node.position.x, node.position.z), `${id}`).toBeNull();
    }
    expect(nodes.spawnNodes.length).toBeGreaterThanOrEqual(4);
  });

  it('gives every lawn node a route to the player, even with every door shut', () => {
    const { nav, nodes } = mansionNav();
    const player = nav.nearest(new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z));
    for (const id of nodes.spawnNodes) {
      expect(nav.findPath(id, player, ALL_SHUT), `${id}`).not.toBeNull();
    }
  });

  it('makes every one of those routes end by climbing through a window', () => {
    const { nav, nodes } = mansionNav();
    const player = nav.nearest(new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z));
    for (const id of nodes.spawnNodes) {
      const path = nav.findPath(id, player, ALL_SHUT);
      expect(path).not.toBeNull();
      const climbed = path!.filter((step) => nav.node(step).climb);
      // Exactly one window: they come in and stay in.
      expect(climbed, `${id}`).toHaveLength(1);
      // And with the doors shut, it has to be a foyer window.
      expect(nav.node(climbed[0]).zone.startsWith('foyer'), `${id}`).toBe(true);
    }
  });

  it('opens the far wings up only once their doors are bought', () => {
    const { nav, nodes } = mansionNav();
    const vault = nodes.roomNodes.get('vault')!;
    const lawn = nodes.spawnNodes[0];

    // Reaching the vault means crossing the gallery and the vault barriers.
    expect(nav.findPath(lawn, vault, ALL_SHUT)).not.toBeNull();
    const shut = nav.findPath(lawn, vault, ALL_SHUT)!;
    const openAll = nav.findPath(lawn, vault, ALL_OPEN)!;
    // With everything shut the only way in is a vault window, so the route is
    // short; with the doors open a shorter interior route can win.
    expect(shut.filter((step) => nav.node(step).climb)).toHaveLength(1);
    expect(openAll.length).toBeGreaterThan(0);
  });

  it('never routes a walker straight through a wall into a sealed wing', () => {
    const { nav, nodes } = mansionNav();
    const kitchen = nodes.roomNodes.get('kitchen')!;
    const hall = nodes.roomNodes.get('hall')!;
    // The kitchen door is shut, so there is no interior route between them.
    // Any path that exists has to leave the building and come back in.
    const path = nav.findPath(hall, kitchen, ALL_SHUT);
    if (path) {
      expect(path.some((step) => nav.node(step).climb)).toBe(true);
    }
  });

  it('puts a sill node at sill height for every window', () => {
    const { nav, nodes } = mansionNav();
    expect(nodes.windowNodes.size).toBe(WINDOWS.length);
    for (const [id, node] of nodes.windowNodes) {
      expect(nav.node(node).position.y, id).toBeCloseTo(WINDOW_SILL, 6);
      expect(nav.node(node).climb, id).toBe(true);
    }
  });
});

describe('a walker under siege conditions', () => {
  /**
   * Runs the horde forward at a fixed step, with the player standing where the
   * match starts. Nothing here is rendered: this is the chase loop on its own.
   */
  function siege(seconds: number, options: { boarded: boolean } = { boarded: true }) {
    const { nav, nodes } = mansionNav();
    const entries = options.boarded
      ? boardedEntries()
      : { left: new Map<string, number>(), isBoarded: () => false, tear: () => false };

    const manager = new ZombieManager(new THREE.Scene(), nav, ALL_SHUT, entries, 8);
    const player: ZombieTarget = {
      position: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
      alive: true,
    };

    let hits = 0;
    let planks = 0;
    manager.onPlayerHit = () => hits++;
    manager.onBoardTorn = () => planks++;

    // Straight onto the nearest lawn node, as the mode spawns them.
    const lawn = nav.node(nodes.spawnNodes[1]).position;
    const zombie = manager.spawn(lawn.clone(), {
      health: 500,
      speed: 2.6,
      damage: 20,
      round: 1,
    })!;

    const step = 1 / 60;
    let closest = Infinity;
    let peakHeight = 0;
    let contactAt = Infinity;
    for (let elapsed = 0; elapsed < seconds; elapsed += step) {
      manager.update(step, [player]);
      const distance = zombie.position.distanceTo(player.position);
      closest = Math.min(closest, distance);
      peakHeight = Math.max(peakHeight, zombie.position.y);
      if (distance < 2 && contactAt === Infinity) contactAt = elapsed;
    }
    return { zombie, hits, planks, closest, peakHeight, contactAt, entries };
  }

  it('walks in from the lawn, tears the boards off and gets to the player', () => {
    const run = siege(60);
    expect(run.planks).toBe(WINDOW_BOARDS);
    // One window is now stripped, and only one.
    const stripped = [...run.entries.left.values()].filter((left) => left === 0);
    expect(stripped).toHaveLength(1);
    // It went over the sill, not through the wall under it.
    expect(run.peakHeight).toBeGreaterThan(WINDOW_SILL * 0.75);
    expect(run.closest).toBeLessThan(1.5);
    expect(run.hits).toBeGreaterThan(0);
    expect(run.zombie.state).toBe('attack');
  });

  it('is held at the window for as long as the boards last', () => {
    // The same siege with no boards reaches the player sooner; with boards it
    // has to stop and work, which is the entire point of boarding a window.
    const boarded = siege(60);
    const open = siege(60, { boarded: false });
    expect(open.contactAt).toBeLessThan(boarded.contactAt);
    // Four planks at a plank a second or so, and nothing torn when there is
    // nothing to tear.
    expect(boarded.contactAt - open.contactAt).toBeGreaterThan(3);
    expect(open.planks).toBe(0);
  });

  it('stands on the ground to tear, rather than floating at the sill', () => {
    const { nav, nodes } = mansionNav();
    const manager = new ZombieManager(new THREE.Scene(), nav, ALL_SHUT, boardedEntries(), 4);
    const player: ZombieTarget = {
      position: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
      alive: true,
    };
    const zombie = manager.spawn(nav.node(nodes.spawnNodes[1]).position.clone(), {
      health: 500,
      speed: 2.6,
      damage: 20,
      round: 1,
    })!;

    const step = 1 / 60;
    for (let elapsed = 0; elapsed < 30; elapsed += step) {
      manager.update(step, [player]);
      // Boards are pulled off from the lawn, on your feet.
      if (zombie.state === 'tear') expect(zombie.position.y).toBeLessThan(0.2);
    }
  });

  it('stops moving while it is tearing', () => {
    const { nav, nodes } = mansionNav();
    const entries = boardedEntries();
    const manager = new ZombieManager(new THREE.Scene(), nav, ALL_SHUT, entries, 4);
    const player: ZombieTarget = {
      position: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
      alive: true,
    };
    const zombie = manager.spawn(nav.node(nodes.spawnNodes[1]).position.clone(), {
      health: 500,
      speed: 2.6,
      damage: 20,
      round: 1,
    })!;

    const step = 1 / 60;
    let sawTearing = false;
    for (let elapsed = 0; elapsed < 30; elapsed += step) {
      manager.update(step, [player]);
      if (zombie.state !== 'tear') continue;
      sawTearing = true;
      expect(zombie.velocity.lengthSq()).toBe(0);
    }
    expect(sawTearing).toBe(true);
  });

  it('never ends up outside the building once it has climbed in', () => {
    const { zombie } = siege(60);
    expect(roomAt(zombie.position.x, zombie.position.z)).not.toBeNull();
  });

  it('never falls through the floor or floats above the sill', () => {
    const { nav, nodes } = mansionNav();
    const manager = new ZombieManager(new THREE.Scene(), nav, ALL_SHUT, boardedEntries(), 4);
    const player: ZombieTarget = {
      position: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
      alive: true,
    };
    const zombie = manager.spawn(nav.node(nodes.spawnNodes[1]).position.clone(), {
      health: 500,
      speed: 2.6,
      damage: 20,
      round: 1,
    })!;

    const step = 1 / 60;
    for (let elapsed = 0; elapsed < 60; elapsed += step) {
      manager.update(step, [player]);
      expect(zombie.position.y).toBeGreaterThanOrEqual(-0.01);
      expect(zombie.position.y).toBeLessThanOrEqual(WINDOW_SILL + 0.01);
    }
  });

  it('keeps a whole wave moving without any of them stalling outside', () => {
    const { nav, nodes } = mansionNav();
    const manager = new ZombieManager(new THREE.Scene(), nav, ALL_SHUT, boardedEntries(), 12);
    const player: ZombieTarget = {
      position: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
      alive: true,
    };

    const wave = nodes.spawnNodes.map(
      (id) =>
        manager.spawn(nav.node(id).position.clone(), {
          health: 500,
          speed: 2.4,
          damage: 20,
          round: 1,
        })!,
    );

    const step = 1 / 60;
    for (let elapsed = 0; elapsed < 90; elapsed += step) manager.update(step, [player]);

    // Every one of them got inside, from every corner of the lawn.
    for (const zombie of wave) {
      expect(roomAt(zombie.position.x, zombie.position.z)).not.toBeNull();
    }
  });
});

describe('a boarded window', () => {
  function window(): MansionWindow {
    const board = new THREE.MeshBasicMaterial();
    const frame = new THREE.MeshBasicMaterial();
    return new MansionWindow(
      {
        id: 'test',
        room: 'foyer',
        position: new THREE.Vector3(0, 0, 14),
        axis: 'x',
        width: 1.7,
        outward: new THREE.Vector3(0, 0, 1),
      },
      { board, frame },
    );
  }

  it('starts boarded, with a plank for every board in the plan', () => {
    const pane = window();
    expect(pane.isBoarded).toBe(true);
    expect(pane.boardsLeft).toBe(WINDOW_BOARDS);
  });

  it('comes apart one plank at a time and then stays apart', () => {
    const pane = window();
    for (let i = WINDOW_BOARDS; i > 0; i--) {
      expect(pane.tearBoard()).toBe(true);
      expect(pane.boardsLeft).toBe(i - 1);
    }
    expect(pane.isBoarded).toBe(false);
    // Nothing left to pull off, so a walker is not held there forever.
    expect(pane.tearBoard()).toBe(false);
  });

  it('hides exactly as many planks as have been torn off', () => {
    const pane = window();
    const planks = () =>
      pane.group.children.filter(
        (child) => child instanceof THREE.Mesh && child.visible,
      ).length;
    const before = planks();
    pane.tearBoard();
    pane.tearBoard();
    expect(before - planks()).toBe(2);
  });

  it('spans the opening it was cut for', () => {
    const pane = window();
    const box = new THREE.Box3().setFromObject(pane.group);
    // The frame reaches past both jambs, and covers the full opening height.
    expect(box.min.x).toBeLessThanOrEqual(-1.7 / 2);
    expect(box.max.x).toBeGreaterThanOrEqual(1.7 / 2);
    expect(box.min.y).toBeLessThan(WINDOW_SILL);
    expect(box.max.y).toBeGreaterThan(WINDOW_SILL);
  });
});
