import * as THREE from 'three';
import type { NavGraph } from '../map/NavGraph';
import { Zombie } from './Zombie';

export interface ZombieTarget {
  /** Feet position of a live player. */
  readonly position: THREE.Vector3;
  readonly alive: boolean;
}

export interface ZombieHit {
  zombie: Zombie;
  killed: boolean;
  /** True when the round should count this as a kill. */
  point: THREE.Vector3;
}

const HURT_TIME = 0.18;
const DEATH_TIME = 1.1;
const ATTACK_RANGE = 1.5;
const ATTACK_INTERVAL = 1.05;
const REPATH_INTERVAL = 0.55;
const ARRIVE_RADIUS = 0.7;
const ZOMBIE_RADIUS = 0.42;
const BODY_HEIGHT = 1.75;

const tmpDirection = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const tmpPosition = new THREE.Vector3();
const tmpColor = new THREE.Color();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Owns the whole horde: a fixed pool of walkers, their navigation, their
 * combat, and their rendering. The crowd is drawn as four instanced meshes
 * (torso, head, two arms) so hundreds of zombies stay at four draw calls and
 * no scene objects are created or destroyed while playing.
 */
export class ZombieManager {
  readonly group = new THREE.Group();

  private readonly pool: Zombie[] = [];
  private readonly torso: THREE.InstancedMesh;
  private readonly head: THREE.InstancedMesh;
  private readonly armLeft: THREE.InstancedMesh;
  private readonly armRight: THREE.InstancedMesh;
  private readonly materials: THREE.Material[] = [];

  /** Reported to the round manager when a zombie dies. */
  onKilled: ((zombie: Zombie) => void) | null = null;
  /** Reported when a zombie lands a melee hit. */
  onPlayerHit: ((targetIndex: number, damage: number) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly nav: NavGraph,
    private readonly isBarrierOpen: (id: string) => boolean,
    readonly capacity = 48,
  ) {
    for (let i = 0; i < capacity; i++) this.pool.push(new Zombie());

    const skin = new THREE.MeshLambertMaterial({ color: 0x6f7f63 });
    const cloth = new THREE.MeshLambertMaterial({ color: 0x3c4450 });
    this.materials.push(skin, cloth);

    this.torso = this.createLayer(new THREE.BoxGeometry(0.62, 0.95, 0.34), cloth);
    this.head = this.createLayer(new THREE.BoxGeometry(0.34, 0.36, 0.34), skin);
    this.armLeft = this.createLayer(new THREE.BoxGeometry(0.17, 0.62, 0.17), skin);
    this.armRight = this.createLayer(new THREE.BoxGeometry(0.17, 0.62, 0.17), skin);

    scene.add(this.group);
  }

  get activeCount(): number {
    let count = 0;
    for (const zombie of this.pool) if (zombie.active) count++;
    return count;
  }

  /** Live zombies belonging to a given round. */
  countAliveInRound(round: number): number {
    let count = 0;
    for (const zombie of this.pool) {
      if (zombie.active && zombie.state !== 'dead' && zombie.round === round) count++;
    }
    return count;
  }

  forEachAlive(callback: (zombie: Zombie) => void): void {
    for (const zombie of this.pool) {
      if (zombie.active && zombie.state !== 'dead') callback(zombie);
    }
  }

  /** @returns the spawned zombie, or null when the pool is saturated. */
  spawn(
    position: THREE.Vector3,
    stats: { health: number; speed: number; damage: number; round: number },
  ): Zombie | null {
    const zombie = this.pool.find((candidate) => !candidate.active);
    if (!zombie) return null;
    zombie.spawn(position, stats.health, stats.speed, stats.damage, stats.round);
    return zombie;
  }

  /**
   * Segment query against the horde, used by the ballistics scanner. Zombies
   * are capsules approximated by a vertical cylinder.
   */
  intersect(from: THREE.Vector3, to: THREE.Vector3): { zombie: Zombie; distance: number } | null {
    tmpDirection.subVectors(to, from);
    const length = tmpDirection.length();
    if (length < 1e-6) return null;
    tmpDirection.divideScalar(length);

    let best: Zombie | null = null;
    let bestDistance = length;

    for (const zombie of this.pool) {
      if (!zombie.active || zombie.state === 'dead') continue;
      tmpPosition.copy(zombie.position);
      tmpPosition.y += BODY_HEIGHT * 0.5;
      tmpPosition.sub(from);

      const along = tmpPosition.dot(tmpDirection);
      if (along < 0 || along > bestDistance) continue;
      // Perpendicular distance from the ray to the body centre.
      const perpendicularSq = tmpPosition.lengthSq() - along * along;
      const reach = ZOMBIE_RADIUS + 0.18;
      if (perpendicularSq > reach * reach) continue;
      // Vertical extent check so shots over their heads miss.
      const hitY = from.y + tmpDirection.y * along;
      if (hitY < zombie.position.y - 0.1 || hitY > zombie.position.y + BODY_HEIGHT + 0.15) continue;

      best = zombie;
      bestDistance = along;
    }

    return best ? { zombie: best, distance: bestDistance } : null;
  }

  update(dt: number, targets: readonly ZombieTarget[]): void {
    for (const zombie of this.pool) {
      if (!zombie.active) continue;
      if (zombie.state === 'dead') {
        this.updateDead(zombie, dt);
        continue;
      }
      this.updateAlive(zombie, dt, targets);
    }
    this.render();
  }

  clear(): void {
    for (const zombie of this.pool) zombie.active = false;
    this.render();
  }

  /** Kills every live zombie belonging to a round. Used by the nuke. */
  killRound(round: number): Zombie[] {
    const killed: Zombie[] = [];
    for (const zombie of this.pool) {
      if (!zombie.active || zombie.state === 'dead' || zombie.round !== round) continue;
      zombie.state = 'dead';
      zombie.stateTimer = 0;
      killed.push(zombie);
    }
    return killed;
  }

  dispose(): void {
    for (const layer of [this.torso, this.head, this.armLeft, this.armRight]) {
      layer.geometry.dispose();
      layer.dispose();
    }
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.group.removeFromParent();
  }

  private createLayer(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    for (let i = 0; i < this.capacity; i++) {
      mesh.setMatrixAt(i, HIDDEN);
      mesh.setColorAt(i, tmpColor.setScalar(1));
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    return mesh;
  }

  private updateDead(zombie: Zombie, dt: number): void {
    zombie.stateTimer += dt;
    if (zombie.stateTimer >= DEATH_TIME) zombie.active = false;
  }

  private updateAlive(zombie: Zombie, dt: number, targets: readonly ZombieTarget[]): void {
    if (zombie.state === 'hurt') {
      zombie.stateTimer += dt;
      if (zombie.stateTimer >= HURT_TIME) zombie.state = 'chase';
    }

    const target = this.pickTarget(zombie, targets);
    if (!target) {
      zombie.state = 'idle';
      zombie.velocity.set(0, 0, 0);
      return;
    }

    const distance = zombie.position.distanceTo(target.position);
    zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);

    if (distance <= ATTACK_RANGE) {
      zombie.state = 'attack';
      zombie.velocity.set(0, 0, 0);
      this.faceTowards(zombie, target.position, dt);
      if (zombie.attackCooldown <= 0) {
        zombie.attackCooldown = ATTACK_INTERVAL;
        this.onPlayerHit?.(zombie.target, zombie.damage);
      }
      return;
    }

    if (zombie.state !== 'hurt') zombie.state = 'chase';
    this.followPath(zombie, target.position, dt);
  }

  private pickTarget(zombie: Zombie, targets: readonly ZombieTarget[]): ZombieTarget | null {
    let best: ZombieTarget | null = null;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const candidate = targets[i];
      if (!candidate.alive) continue;
      const distance = candidate.position.distanceToSquared(zombie.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
        bestIndex = i;
      }
    }
    zombie.target = bestIndex;
    return best;
  }

  private followPath(zombie: Zombie, goal: THREE.Vector3, dt: number): void {
    zombie.repathTimer -= dt;
    if (zombie.repathTimer <= 0 || zombie.pathCursor >= zombie.path.length) {
      zombie.repathTimer = REPATH_INTERVAL;
      const from = this.nav.nearest(zombie.position);
      const to = this.nav.nearest(goal);
      const path = this.nav.findPath(from, to, this.isBarrierOpen);
      if (path) {
        zombie.path = path;
        zombie.pathCursor = 0;
      }
    }

    if (zombie.pathCursor >= zombie.path.length) {
      zombie.velocity.set(0, 0, 0);
      return;
    }

    const waypoint = this.nav.node(zombie.path[zombie.pathCursor]).position;
    tmpDirection.subVectors(waypoint, zombie.position);
    const flat = Math.hypot(tmpDirection.x, tmpDirection.z);
    if (flat < ARRIVE_RADIUS) {
      zombie.pathCursor++;
      return;
    }

    tmpDirection.divideScalar(flat || 1);
    zombie.velocity.set(tmpDirection.x * zombie.speed, 0, tmpDirection.z * zombie.speed);
    zombie.position.x += zombie.velocity.x * dt;
    zombie.position.z += zombie.velocity.z * dt;
    // Follow the waypoint height, which carries them up ramps.
    zombie.position.y += (waypoint.y - zombie.position.y) * Math.min(1, dt * 4);

    zombie.gait += dt * (2.6 + zombie.speed);
    this.faceTowards(zombie, waypoint, dt);
  }

  private faceTowards(zombie: Zombie, point: THREE.Vector3, dt: number): void {
    const desired = Math.atan2(point.x - zombie.position.x, point.z - zombie.position.z);
    let delta = desired - zombie.facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    zombie.facing += delta * Math.min(1, dt * 8);
  }

  /** Rebuilds every instance matrix. One pass, no allocation. */
  private render(): void {
    let index = 0;
    for (const zombie of this.pool) {
      if (!zombie.active) continue;

      const walking = zombie.state === 'chase';
      const swing = walking ? Math.sin(zombie.gait) : 0;
      const lurch = walking ? Math.abs(Math.cos(zombie.gait)) * 0.06 : 0;
      // Dying zombies sink and tip over.
      const dying = zombie.state === 'dead' ? Math.min(1, zombie.stateTimer / DEATH_TIME) : 0;
      const sink = dying * 1.1;
      const tip = dying * 1.35;

      tmpQuaternion.setFromEuler(new THREE.Euler(tip, zombie.facing, 0, 'YXZ'));

      const baseY = zombie.position.y - sink;
      tmpPosition.set(zombie.position.x, baseY + 1.05 + lurch, zombie.position.z);
      tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
      this.torso.setMatrixAt(index, tmpMatrix);

      tmpPosition.set(zombie.position.x, baseY + 1.72 + lurch, zombie.position.z);
      tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
      this.head.setMatrixAt(index, tmpMatrix);

      // Arms reach forward, swinging out of phase.
      this.placeArm(this.armLeft, index, zombie, baseY, -0.4, swing, tmpQuaternion);
      this.placeArm(this.armRight, index, zombie, baseY, 0.4, -swing, tmpQuaternion);

      // Flash white on hit, darken on death.
      const flash = zombie.state === 'hurt' ? 1 - zombie.stateTimer / HURT_TIME : 0;
      tmpColor.setScalar(1 - dying * 0.6).addScalar(flash * 1.4);
      this.torso.setColorAt(index, tmpColor);
      this.head.setColorAt(index, tmpColor);

      index++;
    }

    for (const layer of [this.torso, this.head, this.armLeft, this.armRight]) {
      for (let i = index; i < this.capacity; i++) layer.setMatrixAt(i, HIDDEN);
      layer.instanceMatrix.needsUpdate = true;
      if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
    }
  }

  private placeArm(
    layer: THREE.InstancedMesh,
    index: number,
    zombie: Zombie,
    baseY: number,
    side: number,
    swing: number,
    rotation: THREE.Quaternion,
  ): void {
    const forward = Math.cos(zombie.facing);
    const right = Math.sin(zombie.facing);
    tmpPosition.set(
      zombie.position.x + forward * side + right * 0.34,
      baseY + 1.18 + swing * 0.08,
      zombie.position.z - right * side + forward * 0.34,
    );
    tmpMatrix.compose(tmpPosition, rotation, tmpScale);
    layer.setMatrixAt(index, tmpMatrix);
  }
}
