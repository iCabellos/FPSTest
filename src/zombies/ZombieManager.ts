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

/** A segment query result against the horde. */
export interface ZombieQuery {
  zombie: Zombie;
  distance: number;
  /** True when the round entered through the head sphere. */
  headshot: boolean;
}

/** Gates a walker has to get through to reach the player. */
export interface EntryGate {
  /** True while the entry named by a nav zone still has planks across it. */
  isBoarded: (zone: string) => boolean;
  /** Pulls one plank off. @returns true when one came away. */
  tear: (zone: string) => boolean;
}

const ALWAYS_CLEAR: EntryGate = { isBoarded: () => false, tear: () => false };

const HURT_TIME = 0.18;
const DEATH_TIME = 1.1;
const ATTACK_RANGE = 1.5;
const ATTACK_INTERVAL = 1.05;
const REPATH_INTERVAL = 0.55;
const ARRIVE_RADIUS = 0.7;
/** Tighter for sills, so a walker goes through the opening, not past it. */
const CLIMB_ARRIVE_RADIUS = 0.3;
const ZOMBIE_RADIUS = 0.42;
const BODY_HEIGHT = 1.75;
/** Matches the head instance in {@link ZombieManager.render}. */
const HEAD_Y = 1.72;
const HEAD_RADIUS = 0.26;
/** Seconds between planks while tearing at a window. */
const TEAR_INTERVAL = 1.15;
/** How close a walker gets to a window before it starts pulling boards. */
const TEAR_RANGE = 1.6;
/** Speed multiplier while hauling itself over a sill. */
const CLIMB_SPEED = 0.42;
/** Distance either side of a sill over which a walker rises and drops. */
const CLIMB_RISE = 1.1;

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
  /** Reported when a plank is pulled off, so the mode can play the sound. */
  onBoardTorn: ((zombie: Zombie) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly nav: NavGraph,
    private readonly isBarrierOpen: (id: string) => boolean,
    private readonly entries: EntryGate = ALWAYS_CLEAR,
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
   * Segment query against the horde, used by the ballistics scanner.
   *
   * Two volumes per walker: a sphere on the head, which is where the head
   * instance is actually drawn, and a vertical cylinder for the body. The head
   * is tested first and wins ties, so a round that clips both counts as the
   * headshot the player was aiming for.
   */
  intersect(from: THREE.Vector3, to: THREE.Vector3): ZombieQuery | null {
    tmpDirection.subVectors(to, from);
    const length = tmpDirection.length();
    if (length < 1e-6) return null;
    tmpDirection.divideScalar(length);

    let best: Zombie | null = null;
    let bestDistance = length;
    let bestHeadshot = false;

    for (const zombie of this.pool) {
      if (!zombie.active || zombie.state === 'dead') continue;

      const head = this.intersectHead(zombie, from, bestDistance);
      if (head !== null) {
        best = zombie;
        bestDistance = head;
        bestHeadshot = true;
        continue;
      }

      const body = this.intersectBody(zombie, from, bestDistance);
      if (body === null) continue;
      best = zombie;
      bestDistance = body;
      bestHeadshot = false;
    }

    return best ? { zombie: best, distance: bestDistance, headshot: bestHeadshot } : null;
  }

  /** Ray against the head sphere. @returns the entry distance, or null. */
  private intersectHead(zombie: Zombie, from: THREE.Vector3, limit: number): number | null {
    tmpPosition.copy(zombie.position);
    tmpPosition.y += HEAD_Y;
    tmpPosition.sub(from);

    const along = tmpPosition.dot(tmpDirection);
    if (along < 0) return null;
    const perpendicularSq = tmpPosition.lengthSq() - along * along;
    if (perpendicularSq > HEAD_RADIUS * HEAD_RADIUS) return null;

    // Entry point rather than closest approach, so a graze reads as a graze.
    const entry = along - Math.sqrt(HEAD_RADIUS * HEAD_RADIUS - perpendicularSq);
    if (entry > limit) return null;
    return Math.max(0, entry);
  }

  /**
   * Ray against the body, treated as a standing cylinder.
   *
   * Solved in the horizontal plane and then range checked vertically, rather
   * than as a sphere around the chest: a sphere leaves the shins and the
   * shoulders unhittable, so rounds pass through parts of a walker you can
   * plainly see.
   *
   * @returns the entry distance, or null.
   */
  private intersectBody(zombie: Zombie, from: THREE.Vector3, limit: number): number | null {
    const ox = from.x - zombie.position.x;
    const oz = from.z - zombie.position.z;
    const a = tmpDirection.x * tmpDirection.x + tmpDirection.z * tmpDirection.z;
    // A perfectly vertical shot never enters the side of the column.
    if (a < 1e-8) return null;

    const b = 2 * (ox * tmpDirection.x + oz * tmpDirection.z);
    const c = ox * ox + oz * oz - ZOMBIE_RADIUS * ZOMBIE_RADIUS;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const root = Math.sqrt(discriminant);
    // Near face first; fall back to the far one when the muzzle is inside.
    let entry = (-b - root) / (2 * a);
    if (entry < 0) entry = (-b + root) / (2 * a);
    if (entry < 0 || entry > limit) return null;

    // Vertical extent, so shots over their heads and into the floor miss.
    const hitY = from.y + tmpDirection.y * entry;
    if (hitY < zombie.position.y - 0.05) return null;
    if (hitY > zombie.position.y + BODY_HEIGHT + 0.15) return null;
    return entry;
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
    zombie.tearCooldown = Math.max(0, zombie.tearCooldown - dt);

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
      // Search from the waypoint already being walked to, not from whichever
      // node happens to be nearest. Re-anchoring on the nearest node makes a
      // walker turn round every time the timer fires — it has left the node
      // behind it but has not yet reached the one ahead — and it also lets a
      // route skip the doorway it was halfway through. Finishing the current
      // leg first avoids both.
      const from =
        zombie.pathCursor < zombie.path.length
          ? zombie.path[zombie.pathCursor]
          : this.nav.nearest(zombie.position);
      const path = this.nav.findPath(from, this.nav.nearest(goal), this.isBarrierOpen);
      if (path) {
        zombie.path = path;
        zombie.pathCursor = 0;
      }
    }

    if (zombie.pathCursor >= zombie.path.length) {
      zombie.velocity.set(0, 0, 0);
      return;
    }

    const node = this.nav.node(zombie.path[zombie.pathCursor]);
    const waypoint = node.position;
    tmpDirection.subVectors(waypoint, zombie.position);
    const flat = Math.hypot(tmpDirection.x, tmpDirection.z);

    // A boarded window is a wall until the planks are off it.
    if (node.climb && flat < TEAR_RANGE && this.entries.isBoarded(node.zone)) {
      this.tearAt(zombie, node.zone, waypoint, dt);
      return;
    }

    // Latch onto the sill as soon as one is the next waypoint, and hold it
    // until the walker is clear on the far side.
    if (node.climb) {
      zombie.climbing = true;
      zombie.climbAnchor.copy(waypoint);
    }

    if (flat < (node.climb ? CLIMB_ARRIVE_RADIUS : ARRIVE_RADIUS)) {
      zombie.pathCursor++;
      return;
    }

    if (zombie.state !== 'hurt') zombie.state = 'chase';
    // Hauling yourself over a sill is slower than walking at it.
    const speed = zombie.speed * (zombie.climbing ? CLIMB_SPEED : 1);
    tmpDirection.divideScalar(flat || 1);
    zombie.velocity.set(tmpDirection.x * speed, 0, tmpDirection.z * speed);
    zombie.position.x += zombie.velocity.x * dt;
    zombie.position.z += zombie.velocity.z * dt;
    this.updateClimbHeight(zombie, waypoint.y, dt);

    zombie.gait += dt * (2.6 + speed);
    this.faceTowards(zombie, waypoint, dt);
  }

  /**
   * Height while crossing a window: one arc peaking on the sill, measured from
   * the sill itself rather than from whichever waypoint is next.
   *
   * Driving the height off the waypoint alone puts a walker a metre in the air
   * while it is still out on the lawn, and drops it back to the floor before
   * it has actually gone through the hole — so it clips the solid wall under
   * the window instead of climbing over it.
   */
  private updateClimbHeight(zombie: Zombie, waypointY: number, dt: number): void {
    let targetY = waypointY;
    if (zombie.climbing) {
      const distance = Math.hypot(
        zombie.position.x - zombie.climbAnchor.x,
        zombie.position.z - zombie.climbAnchor.z,
      );
      targetY = zombie.climbAnchor.y * Math.max(0, 1 - distance / CLIMB_RISE);
      // Clear of the window and back on the floor: the climb is over.
      if (distance > CLIMB_RISE) zombie.climbing = false;
    }
    zombie.position.y += (targetY - zombie.position.y) * Math.min(1, dt * 10);
  }

  /** Stops at the window and pulls a plank off on a cooldown. */
  private tearAt(zombie: Zombie, zone: string, waypoint: THREE.Vector3, dt: number): void {
    zombie.state = 'tear';
    zombie.velocity.set(0, 0, 0);
    this.faceTowards(zombie, waypoint, dt);
    zombie.gait += dt * 7;
    if (zombie.tearCooldown > 0) return;

    zombie.tearCooldown = TEAR_INTERVAL;
    if (this.entries.tear(zone)) this.onBoardTorn?.(zombie);
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

      // Tearing swings the arms too: it reads as clawing at the boards.
      const walking = zombie.state === 'chase' || zombie.state === 'tear';
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
