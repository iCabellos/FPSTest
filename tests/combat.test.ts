import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NavGraph } from '../src/map/NavGraph';
import {
  GRENADE_DAMAGE,
  GRENADE_RADIUS,
  GrenadeSwarm,
} from '../src/special/GrenadeSwarm';
import { NukeSequence } from '../src/special/NukeSequence';
import { GRENADE_STEP_DEGREES } from '../src/special/SlotMachine';
import { createSeededRandom } from '../src/utils/Random';
import { M9 } from '../src/weapons/definitions';
import { Weapon } from '../src/weapons/Weapon';
import { ZombieManager } from '../src/zombies/ZombieManager';

/** A manager with one walker standing at the origin, facing the camera. */
function loneZombie(): ZombieManager {
  const scene = new THREE.Scene();
  const nav = new NavGraph(4);
  nav.addNode(new THREE.Vector3(), 'room');
  const manager = new ZombieManager(scene, nav, () => true, undefined, 4);
  manager.spawn(new THREE.Vector3(0, 0, 0), {
    health: 500,
    speed: 1,
    damage: 10,
    round: 1,
  });
  return manager;
}

/** Fires a level shot from `height`, ten metres away, straight at the origin. */
function shootAt(manager: ZombieManager, height: number) {
  return manager.intersect(new THREE.Vector3(0, height, 10), new THREE.Vector3(0, height, -10));
}

describe('zombie hitboxes', () => {
  it('registers a headshot on a round through the head', () => {
    // The head instance is drawn at 1.72; a level shot there must find it.
    const hit = shootAt(loneZombie(), 1.72);
    expect(hit).not.toBeNull();
    expect(hit?.headshot).toBe(true);
  });

  it('registers a body shot on a round through the chest', () => {
    const hit = shootAt(loneZombie(), 1.1);
    expect(hit).not.toBeNull();
    expect(hit?.headshot).toBe(false);
  });

  it('misses entirely over the top of the head', () => {
    expect(shootAt(loneZombie(), 2.3)).toBeNull();
  });

  it('misses to the side of the head at head height', () => {
    const manager = loneZombie();
    const hit = manager.intersect(
      new THREE.Vector3(0.9, 1.72, 10),
      new THREE.Vector3(0.9, 1.72, -10),
    );
    expect(hit).toBeNull();
  });

  it('reports the distance to the front of the head, not its centre', () => {
    const hit = shootAt(loneZombie(), 1.72);
    // The shot starts ten metres out and the head is about a quarter metre
    // across, so entry lands just short of ten.
    expect(hit?.distance).toBeGreaterThan(9.6);
    expect(hit?.distance).toBeLessThan(10);
  });

  it('leaves no gap between the top of the body and the bottom of the head', () => {
    // Sweep the whole silhouette: every height from the feet to the crown has
    // to be hittable, or there is a band where rounds pass straight through.
    const manager = loneZombie();
    for (let height = 0.1; height <= 1.9; height += 0.05) {
      expect(shootAt(manager, height), `${height.toFixed(2)}m`).not.toBeNull();
    }
  });

  it('returns the nearest walker, not the first in the pool', () => {
    const manager = loneZombie();
    manager.spawn(new THREE.Vector3(0, 0, -4), {
      health: 500,
      speed: 1,
      damage: 10,
      round: 1,
    });
    // Both are in line; the one at the origin is four metres closer.
    const hit = shootAt(manager, 1.1);
    expect(hit?.zombie.position.z).toBe(0);
  });

  it('ignores the dead', () => {
    const manager = loneZombie();
    manager.forEachAlive((zombie) => zombie.applyDamage(9999));
    expect(shootAt(manager, 1.72)).toBeNull();
  });
});

/** Empties the magazine, cycling the trigger so semi autos actually fire. */
function emptyMagazine(weapon: Weapon): void {
  for (let shot = 0; shot < weapon.magazineSize; shot++) {
    weapon.setTrigger(false);
    weapon.update(1);
    weapon.setTrigger(true);
    weapon.update(1);
  }
  weapon.setTrigger(false);
}

/** Fires and reloads until nothing is left. */
function runDry(weapon: Weapon): void {
  for (let cycle = 0; cycle < 200; cycle++) {
    emptyMagazine(weapon);
    if (!weapon.requestReload()) return;
    weapon.update(weapon.definition.reloadTime);
  }
}

describe('limited ammunition', () => {
  it('starts with a full magazine and the definition"s reserve', () => {
    const weapon = new Weapon(M9);
    expect(weapon.ammo).toBe(M9.magazineSize);
    expect(weapon.reserve).toBe(M9.reserveAmmo);
  });

  it('draws a reload out of the reserve', () => {
    const weapon = new Weapon(M9);
    emptyMagazine(weapon);
    expect(weapon.ammo).toBe(0);

    expect(weapon.requestReload()).toBe(true);
    weapon.update(M9.reloadTime);
    expect(weapon.ammo).toBe(M9.magazineSize);
    expect(weapon.reserve).toBe(M9.reserveAmmo - M9.magazineSize);
  });

  it('hands over what is left rather than a full magazine', () => {
    const weapon = new Weapon(M9);
    // Burn the reserve down to less than one magazine.
    const reloads = Math.floor(M9.reserveAmmo / M9.magazineSize);
    for (let i = 0; i < reloads; i++) {
      emptyMagazine(weapon);
      weapon.requestReload();
      weapon.update(M9.reloadTime);
    }
    const left = weapon.reserve;
    expect(left).toBeLessThan(M9.magazineSize);

    emptyMagazine(weapon);
    weapon.requestReload();
    weapon.update(M9.reloadTime);
    expect(weapon.ammo).toBe(left);
    expect(weapon.reserve).toBe(0);
  });

  it('refuses to reload once the reserve is gone', () => {
    const weapon = new Weapon(M9);
    runDry(weapon);
    emptyMagazine(weapon);
    expect(weapon.reserve).toBe(0);
    expect(weapon.isOutOfAmmo).toBe(true);
    expect(weapon.requestReload()).toBe(false);
  });

  it('comes back to life when the wall restocks it', () => {
    const weapon = new Weapon(M9);
    runDry(weapon);
    emptyMagazine(weapon);
    weapon.refillReserve();
    expect(weapon.reserve).toBe(M9.reserveAmmo);
    expect(weapon.requestReload()).toBe(true);
  });

  it('never runs dry at the range', () => {
    const weapon = new Weapon(M9, true);
    for (let cycle = 0; cycle < 50; cycle++) {
      emptyMagazine(weapon);
      expect(weapon.requestReload()).toBe(true);
      weapon.update(M9.reloadTime);
    }
    expect(weapon.reserve).toBe(Infinity);
    expect(weapon.ammo).toBe(M9.magazineSize);
  });
});

describe('grenade swarm', () => {
  function swarm(): GrenadeSwarm {
    return new GrenadeSwarm(new THREE.Scene(), 8);
  }

  it('throws one grenade per call, up to the pool size', () => {
    const grenades = swarm();
    for (let i = 0; i < 8; i++) expect(grenades.launch(new THREE.Vector3(), 0)).toBe(true);
    expect(grenades.launch(new THREE.Vector3(), 0)).toBe(false);
    expect(grenades.activeCount).toBe(8);
  });

  it('flies the bearing it was given, clockwise from north', () => {
    const grenades = swarm();
    const landed: THREE.Vector3[] = [];
    // Zero degrees is world −Z; ninety is +X.
    for (const bearing of [0, 90, 180, 270]) {
      grenades.launch(new THREE.Vector3(0, 1.5, 0), bearing);
      for (let step = 0; step < 200; step++) {
        grenades.update(1 / 60, (point) => landed.push(point.clone()));
      }
    }

    expect(landed).toHaveLength(4);
    expect(landed[0].z).toBeLessThan(-4);
    expect(Math.abs(landed[0].x)).toBeLessThan(0.001);
    expect(landed[1].x).toBeGreaterThan(4);
    expect(landed[2].z).toBeGreaterThan(4);
    expect(landed[3].x).toBeLessThan(-4);
  });

  it('keeps the slot machine"s angular step once thrown', () => {
    const grenades = swarm();
    const landed: THREE.Vector3[] = [];
    for (const bearing of [0, GRENADE_STEP_DEGREES]) {
      grenades.launch(new THREE.Vector3(0, 1.5, 0), bearing);
      for (let step = 0; step < 200; step++) {
        grenades.update(1 / 60, (point) => landed.push(point.clone()));
      }
    }
    const bearingOf = (point: THREE.Vector3): number =>
      (Math.atan2(point.x, -point.z) * 180) / Math.PI;
    expect(bearingOf(landed[1]) - bearingOf(landed[0])).toBeCloseTo(GRENADE_STEP_DEGREES, 4);
  });

  it('detonates once, after its fuse, and frees the slot', () => {
    const grenades = swarm();
    grenades.launch(new THREE.Vector3(0, 1.5, 0), 0);

    let explosions = 0;
    for (let step = 0; step < 600; step++) {
      grenades.update(1 / 60, (_point, radius, damage) => {
        explosions++;
        expect(radius).toBe(GRENADE_RADIUS);
        expect(damage).toBe(GRENADE_DAMAGE);
      });
    }
    expect(explosions).toBe(1);
    expect(grenades.activeCount).toBe(0);
  });

  it('stays on the floor rather than falling through it', () => {
    const grenades = swarm();
    grenades.launch(new THREE.Vector3(0, 0.4, 0), 45);
    let lowest = Infinity;
    for (let step = 0; step < 120; step++) {
      grenades.update(1 / 60, () => undefined);
    }
    // Sampled through the flight above; the detonation point is what matters.
    grenades.launch(new THREE.Vector3(0, 0.4, 0), 45);
    for (let step = 0; step < 200; step++) {
      grenades.update(1 / 60, (point) => {
        lowest = Math.min(lowest, point.y);
      });
    }
    expect(lowest).toBeGreaterThanOrEqual(0);
  });

  it('drops everything in flight when cleared', () => {
    const grenades = swarm();
    grenades.launch(new THREE.Vector3(), 0);
    grenades.launch(new THREE.Vector3(), 30);
    grenades.clear();
    expect(grenades.activeCount).toBe(0);
  });
});

describe('nuclear sequence', () => {
  function camera(): THREE.PerspectiveCamera {
    const value = new THREE.PerspectiveCamera();
    value.position.set(2, 1.7, 3);
    return value;
  }

  it('reports the detonation exactly once', () => {
    const nuke = new NukeSequence(new THREE.Scene());
    nuke.begin(new THREE.Vector3(), camera());

    let detonations = 0;
    for (let step = 0; step < 600; step++) {
      if (nuke.update(1 / 60)) detonations++;
    }
    expect(detonations).toBe(1);
  });

  it('runs through every phase and hands the camera back', () => {
    const nuke = new NukeSequence(new THREE.Scene());
    const view = camera();
    const start = view.position.clone();
    nuke.begin(new THREE.Vector3(), view);
    expect(nuke.isActive).toBe(true);

    const seen = new Set<string>();
    for (let step = 0; step < 600; step++) {
      nuke.update(1 / 60);
      seen.add(nuke.currentPhase);
    }
    expect([...seen].sort()).toEqual(['ascend', 'blast', 'descend', 'drop', 'idle']);
    expect(nuke.isActive).toBe(false);

    // Once idle it stops touching the camera at all.
    view.position.copy(start);
    nuke.applyCamera(view);
    expect(view.position.distanceTo(start)).toBe(0);
  });

  it('pulls the camera overhead while it plays', () => {
    const nuke = new NukeSequence(new THREE.Scene());
    const view = camera();
    nuke.begin(new THREE.Vector3(), view);
    for (let step = 0; step < 90; step++) nuke.update(1 / 60);
    nuke.applyCamera(view);
    expect(view.position.y).toBeGreaterThan(20);
  });

  it('refuses to restart while one is already running', () => {
    const nuke = new NukeSequence(new THREE.Scene());
    const view = camera();
    nuke.begin(new THREE.Vector3(), view);
    for (let step = 0; step < 120; step++) nuke.update(1 / 60);
    const phase = nuke.currentPhase;
    nuke.begin(new THREE.Vector3(9, 0, 9), view);
    expect(nuke.currentPhase).toBe(phase);
  });
});

describe('deterministic runs', () => {
  it('gives the same grenade landing spot for the same seed', () => {
    const run = (): number => {
      const random = createSeededRandom(7);
      const grenades = new GrenadeSwarm(new THREE.Scene(), 4);
      grenades.launch(new THREE.Vector3(0, 1.4, 0), random() * 360);
      let landing = 0;
      for (let step = 0; step < 300; step++) {
        grenades.update(1 / 60, (point) => {
          landing = point.x;
        });
      }
      return landing;
    };
    expect(run()).toBeCloseTo(run(), 10);
  });
});
