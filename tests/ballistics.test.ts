import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BallisticsSystem,
  type SegmentHit,
  type SegmentScanner,
} from '../src/shooting/Ballistics';
import { L96, M4A1 } from '../src/weapons/definitions';
import type { ProjectileConfig } from '../src/weapons/WeaponDefinition';

const ORIGIN = new THREE.Vector3(0, 1.6, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);

/** Scanner that never reports a hit, so rounds fly until they expire. */
const emptyScanner: SegmentScanner = { scan: () => false };

/** Scanner that reports a hit on a vertical plane at a given -Z distance. */
function planeScanner(distance: number): SegmentScanner {
  return {
    scan(from, to, out): boolean {
      const planeZ = -distance;
      if (from.z <= planeZ || to.z > planeZ) return false;
      const t = (from.z - planeZ) / (from.z - to.z);
      out.point.lerpVectors(from, to, t);
      out.normal.set(0, 0, 1);
      out.object = null;
      out.distance = from.distanceTo(out.point);
      return true;
    },
  };
}

function simulate(
  system: BallisticsSystem,
  scanner: SegmentScanner,
  seconds: number,
  step = 1 / 120,
): SegmentHit | null {
  let captured: SegmentHit | null = null;
  let flightTime = 0;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    system.update(step, scanner, ({ hit, projectile }) => {
      flightTime = projectile.time;
      captured = {
        point: hit.point.clone(),
        normal: hit.normal.clone(),
        object: hit.object,
        distance: flightTime,
      };
    });
    if (captured) break;
  }
  return captured;
}

describe('projectile flight', () => {
  it('takes a plausible time to reach 200 m', () => {
    const system = new BallisticsSystem(8);
    system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    const hit = simulate(system, planeScanner(200), 2);

    expect(hit).not.toBeNull();
    // 880 m/s losing speed to drag: somewhere around a quarter of a second.
    expect(hit!.distance).toBeGreaterThan(0.2);
    expect(hit!.distance).toBeLessThan(0.35);
  });

  it('drops under gravity, and more so at longer range', () => {
    const system = new BallisticsSystem(8);

    system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    const near = simulate(system, planeScanner(50), 2);
    system.clear();

    system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    const far = simulate(system, planeScanner(200), 2);

    const nearDrop = ORIGIN.y - near!.point.y;
    const farDrop = ORIGIN.y - far!.point.y;
    expect(nearDrop).toBeGreaterThan(0);
    expect(farDrop).toBeGreaterThan(nearDrop * 4);
    // Still a playable amount of hold over rather than a mortar arc.
    expect(farDrop).toBeLessThan(1);
  });

  it('gives the faster, slicker round less drop than the slower one', () => {
    const system = new BallisticsSystem(8);

    system.spawn(ORIGIN, FORWARD, L96.projectile);
    const sniper = simulate(system, planeScanner(200), 2);
    system.clear();

    system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    const carbine = simulate(system, planeScanner(200), 2);

    expect(ORIGIN.y - sniper!.point.y).toBeLessThan(ORIGIN.y - carbine!.point.y);
  });

  it('bleeds speed to drag', () => {
    const system = new BallisticsSystem(4);
    const projectile = system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    for (let i = 0; i < 60; i++) system.update(1 / 120, emptyScanner, () => {});
    expect(projectile.speed).toBeLessThan(M4A1.projectile.velocity);
    expect(projectile.speed).toBeGreaterThan(M4A1.projectile.velocity * 0.5);
  });
});

describe('projectile lifetime', () => {
  const shortRange: ProjectileConfig = { ...M4A1.projectile, maxDistance: 40 };

  it('retires rounds once they pass their maximum distance', () => {
    const system = new BallisticsSystem(8);
    system.spawn(ORIGIN, FORWARD, shortRange);
    expect(system.activeCount).toBe(1);
    for (let i = 0; i < 60; i++) system.update(1 / 120, emptyScanner, () => {});
    expect(system.activeCount).toBe(0);
  });

  it('never exceeds its pool, reusing the oldest slot instead', () => {
    const capacity = 6;
    const system = new BallisticsSystem(capacity);
    for (let i = 0; i < capacity * 4; i++) {
      system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    }
    expect(system.activeCount).toBe(capacity);
  });

  it('reuses freed slots before recycling live rounds', () => {
    const system = new BallisticsSystem(3);
    system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    system.clear();
    system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    expect(system.activeCount).toBe(1);
  });
});

describe('impact reporting', () => {
  it('reports the hit point on the surface, not past it', () => {
    const system = new BallisticsSystem(4);
    system.spawn(ORIGIN, FORWARD, M4A1.projectile);
    const hit = simulate(system, planeScanner(100), 2);
    expect(hit!.point.z).toBeCloseTo(-100, 5);
    expect(system.activeCount).toBe(0);
  });
});
