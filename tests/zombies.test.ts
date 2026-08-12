import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NavGraph } from '../src/map/NavGraph';
import { DEFAULT_TUNING, RoundManager } from '../src/rounds/RoundManager';
import { Zombie } from '../src/zombies/Zombie';

const OPEN_ALL = (): boolean => true;

function lineGraph(count: number, gate?: { at: number; barrier: string }): NavGraph {
  const graph = new NavGraph(count + 1);
  for (let i = 0; i < count; i++) {
    graph.addNode(new THREE.Vector3(i * 2, 0, 0), i === 0 ? 'start' : 'rest');
  }
  for (let i = 0; i < count - 1; i++) {
    graph.connect(i, i + 1, gate && gate.at === i ? gate.barrier : null);
  }
  return graph;
}

describe('navigation graph', () => {
  it('finds a route along an open chain', () => {
    const graph = lineGraph(5);
    expect(graph.findPath(0, 4, OPEN_ALL)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns the single node when start and goal match', () => {
    expect(lineGraph(3).findPath(1, 1, OPEN_ALL)).toEqual([1]);
  });

  it('refuses to route through a closed barrier', () => {
    const graph = lineGraph(5, { at: 2, barrier: 'door' });
    expect(graph.findPath(0, 4, () => false)).toBeNull();
    // Nodes on this side of the barrier are still reachable.
    expect(graph.findPath(0, 2, () => false)).toEqual([0, 1, 2]);
  });

  it('routes through a barrier once it is open', () => {
    const graph = lineGraph(5, { at: 2, barrier: 'door' });
    expect(graph.findPath(0, 4, (id) => id === 'door')).toEqual([0, 1, 2, 3, 4]);
  });

  it('prefers the cheaper of two routes', () => {
    const graph = new NavGraph(8);
    const start = graph.addNode(new THREE.Vector3(0, 0, 0), 'a');
    const detour = graph.addNode(new THREE.Vector3(0, 0, 20), 'a');
    const middle = graph.addNode(new THREE.Vector3(4, 0, 0), 'a');
    const goal = graph.addNode(new THREE.Vector3(8, 0, 0), 'a');
    graph.connect(start, middle);
    graph.connect(middle, goal);
    graph.connect(start, detour);
    graph.connect(detour, goal);
    expect(graph.findPath(start, goal, OPEN_ALL)).toEqual([start, middle, goal]);
  });

  it('finds the nearest node to an arbitrary point', () => {
    const graph = lineGraph(4);
    expect(graph.nearest(new THREE.Vector3(3.9, 0, 0))).toBe(2);
  });

  it('groups nodes by zone', () => {
    expect(lineGraph(4).nodesInZone('start')).toHaveLength(1);
  });
});

describe('zombie', () => {
  it('spawns alive and chasing', () => {
    const zombie = new Zombie();
    zombie.spawn(new THREE.Vector3(1, 2, 3), 150, 2, 20, 4);
    expect(zombie.active).toBe(true);
    expect(zombie.state).toBe('chase');
    expect(zombie.health).toBe(150);
    expect(zombie.round).toBe(4);
    expect(zombie.position.toArray()).toEqual([1, 2, 3]);
  });

  it('takes damage without dying, then dies', () => {
    const zombie = new Zombie();
    zombie.spawn(new THREE.Vector3(), 100, 2, 20, 1);
    expect(zombie.applyDamage(40)).toBe(false);
    expect(zombie.health).toBe(60);
    expect(zombie.state).toBe('hurt');
    expect(zombie.applyDamage(60)).toBe(true);
    expect(zombie.state).toBe('dead');
  });

  it('cannot be killed twice', () => {
    const zombie = new Zombie();
    zombie.spawn(new THREE.Vector3(), 10, 2, 20, 1);
    expect(zombie.applyDamage(50)).toBe(true);
    expect(zombie.applyDamage(50)).toBe(false);
  });
});

describe('round manager', () => {
  /** Spawns and kills every zombie of the current round. */
  function clearRound(rounds: RoundManager): void {
    const total = rounds.snapshot.zombiesToKill;
    for (let i = 0; i < total; i++) {
      // Advance enough for the spawn timer regardless of interval.
      while (!rounds.shouldSpawn(0.5)) {
        /* wait for the spawn gate */
      }
      rounds.registerSpawn();
      rounds.registerKill();
      rounds.update(1 / 60);
    }
  }

  it('starts at round one with a spawn budget', () => {
    const rounds = new RoundManager();
    rounds.begin();
    const state = rounds.snapshot;
    expect(state.roundNumber).toBe(1);
    expect(state.zombiesToKill).toBe(DEFAULT_TUNING.baseCount);
    expect(state.zombiesRemainingToSpawn).toBe(state.zombiesToKill);
    expect(state.phase).toBe('spawning');
  });

  it('grows the budget each round and with more players', () => {
    const solo = new RoundManager();
    expect(solo.budgetFor(5)).toBeGreaterThan(solo.budgetFor(1));
    const squad = new RoundManager(DEFAULT_TUNING, 4);
    expect(squad.budgetFor(3)).toBeGreaterThan(solo.budgetFor(3));
  });

  it('does not finish a round while zombies are still queued to spawn', () => {
    const rounds = new RoundManager();
    rounds.begin();
    // Kill one that has spawned; the rest of the round has not arrived yet.
    while (!rounds.shouldSpawn(0.5)) {
      /* wait */
    }
    rounds.registerSpawn();
    rounds.registerKill();
    rounds.update(1 / 60);

    expect(rounds.snapshot.zombiesAlive).toBe(0);
    expect(rounds.snapshot.zombiesRemainingToSpawn).toBeGreaterThan(0);
    expect(rounds.phase).toBe('spawning');
  });

  it('moves to clearing once the last zombie has spawned', () => {
    const rounds = new RoundManager();
    rounds.begin();
    const total = rounds.snapshot.zombiesToKill;
    for (let i = 0; i < total; i++) {
      while (!rounds.shouldSpawn(0.5)) {
        /* wait */
      }
      rounds.registerSpawn();
    }
    expect(rounds.phase).toBe('clearing');
    expect(rounds.snapshot.zombiesAlive).toBe(total);
  });

  it('completes the round only when every zombie is dead', () => {
    const rounds = new RoundManager();
    rounds.begin();
    clearRound(rounds);
    expect(rounds.phase).toBe('intermission');
  });

  it('advances to the next round after the intermission', () => {
    const rounds = new RoundManager();
    rounds.begin();
    clearRound(rounds);
    rounds.update(DEFAULT_TUNING.intermission + 0.1);
    expect(rounds.snapshot.roundNumber).toBe(2);
    expect(rounds.phase).toBe('spawning');
    expect(rounds.snapshot.zombiesKilled).toBe(0);
  });

  it('respects the live zombie cap', () => {
    const rounds = new RoundManager({ ...DEFAULT_TUNING, baseCount: 60, maxAlive: 3 });
    rounds.begin();
    for (let i = 0; i < 3; i++) {
      while (!rounds.shouldSpawn(0.5)) {
        /* wait */
      }
      rounds.registerSpawn();
    }
    expect(rounds.snapshot.zombiesAlive).toBe(3);
    // Cap reached: no further spawns until something dies.
    expect(rounds.shouldSpawn(5)).toBe(false);
    rounds.registerKill();
    expect(rounds.shouldSpawn(5)).toBe(true);
  });

  it('never counts more kills than the round owns', () => {
    const rounds = new RoundManager();
    rounds.begin();
    for (let i = 0; i < 200; i++) rounds.registerKill();
    expect(rounds.snapshot.zombiesKilled).toBe(rounds.snapshot.zombiesToKill);
  });

  it('completes the current round early and leaves nothing pending', () => {
    const rounds = new RoundManager();
    rounds.begin();
    while (!rounds.shouldSpawn(0.5)) {
      /* wait */
    }
    rounds.registerSpawn();

    rounds.completeRoundEarly();
    const state = rounds.snapshot;
    expect(state.zombiesRemainingToSpawn).toBe(0);
    expect(state.zombiesAlive).toBe(0);
    expect(state.zombiesKilled).toBe(state.zombiesToKill);
    expect(rounds.phase).toBe('intermission');
  });

  it('ignores an early completion between rounds', () => {
    const rounds = new RoundManager();
    rounds.begin();
    clearRound(rounds);
    expect(rounds.phase).toBe('intermission');
    rounds.completeRoundEarly();
    expect(rounds.snapshot.roundNumber).toBe(1);
  });
});
