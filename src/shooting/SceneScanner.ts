import * as THREE from 'three';
import type { SegmentHit, SegmentScanner } from './Ballistics';

/**
 * Segment queries against the scene using a single reused raycaster.
 * Instanced colliders in this project are translation only, so transforming
 * the face normal by the instanced mesh world matrix is exact.
 */
export class SceneScanner implements SegmentScanner {
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly results: THREE.Intersection[] = [];

  constructor(private readonly colliders: THREE.Object3D[]) {}

  scan(from: THREE.Vector3, to: THREE.Vector3, out: SegmentHit): boolean {
    this.direction.subVectors(to, from);
    const length = this.direction.length();
    if (length < 1e-6) return false;

    this.direction.divideScalar(length);
    this.raycaster.set(from, this.direction);
    this.raycaster.near = 0;
    this.raycaster.far = length;

    this.results.length = 0;
    this.raycaster.intersectObjects(this.colliders, false, this.results);
    if (this.results.length === 0) return false;

    const nearest = this.results[0];
    out.point.copy(nearest.point);
    out.object = nearest.object;
    out.distance = nearest.distance;
    if (nearest.face) {
      out.normal.copy(nearest.face.normal).transformDirection(nearest.object.matrixWorld);
    } else {
      out.normal.copy(this.direction).negate();
    }
    this.results.length = 0;
    return true;
  }

  /** Raycast helper for the HUD range readout. Returns metres or null. */
  measure(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0;
    this.raycaster.far = maxDistance;
    this.results.length = 0;
    this.raycaster.intersectObjects(this.colliders, false, this.results);
    const distance = this.results.length > 0 ? this.results[0].distance : null;
    this.results.length = 0;
    return distance;
  }
}
