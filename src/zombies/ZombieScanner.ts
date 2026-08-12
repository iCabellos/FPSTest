import * as THREE from 'three';
import type { SegmentHit, SegmentScanner } from '../shooting/Ballistics';
import type { SceneScanner } from '../shooting/SceneScanner';
import type { Zombie } from './Zombie';
import type { ZombieManager } from './ZombieManager';

const tmpDirection = new THREE.Vector3();

/**
 * Segment queries that see both the mansion and the horde, returning whichever
 * comes first. The zombie behind the last successful scan is exposed so the
 * impact handler can damage it: ballistics calls `scan` and the impact handler
 * back to back, so there is no window for it to go stale.
 */
export class ZombieScanner implements SegmentScanner {
  lastZombie: Zombie | null = null;

  constructor(
    private readonly world: SceneScanner,
    private readonly zombies: ZombieManager,
  ) {}

  scan(from: THREE.Vector3, to: THREE.Vector3, out: SegmentHit): boolean {
    this.lastZombie = null;

    const hitWorld = this.world.scan(from, to, out);
    const hitZombie = this.zombies.intersect(from, to);
    if (!hitZombie) return hitWorld;
    // A wall in front of the zombie wins.
    if (hitWorld && out.distance <= hitZombie.distance) return true;

    tmpDirection.subVectors(to, from).normalize();
    out.point.copy(from).addScaledVector(tmpDirection, hitZombie.distance);
    out.normal.copy(tmpDirection).negate();
    out.object = null;
    out.distance = hitZombie.distance;
    this.lastZombie = hitZombie.zombie;
    return true;
  }

  /** Distance readout for the HUD; the horde is ignored here. */
  measure(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null {
    return this.world.measure(origin, direction, maxDistance);
  }
}
