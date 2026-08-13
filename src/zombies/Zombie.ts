import * as THREE from 'three';

export type ZombieState = 'idle' | 'chase' | 'attack' | 'tear' | 'hurt' | 'dead';

/**
 * One walker. Plain data plus its own small state machine: rendering is done
 * in bulk by the manager, so a zombie owns no scene objects of its own.
 */
export class Zombie {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();

  active = false;
  state: ZombieState = 'idle';
  health = 0;
  maxHealth = 0;
  speed = 1;
  damage = 0;
  /** Round this zombie belongs to; the nuke only clears the current round. */
  round = 0;
  /** Index of the player being chased, or -1. */
  target = -1;

  /** Waypoint route, as node ids. */
  path: number[] = [];
  pathCursor = 0;
  /** Seconds until the route is recomputed. */
  repathTimer = 0;
  attackCooldown = 0;
  /** Seconds until the next plank comes off the window being torn at. */
  tearCooldown = 0;
  /**
   * Sill currently being crossed. Held from the approach until the walker is
   * clear on the far side, so the rise over the sill and the drop back down
   * are one continuous arc rather than two unrelated waypoint heights.
   */
  readonly climbAnchor = new THREE.Vector3();
  climbing = false;
  /** Drives the hurt flash and the death sink. */
  stateTimer = 0;
  /** Walk cycle phase, kept per zombie so the crowd is not in lockstep. */
  gait = 0;
  facing = 0;

  spawn(position: THREE.Vector3, health: number, speed: number, damage: number, round: number): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.active = true;
    this.state = 'chase';
    this.health = health;
    this.maxHealth = health;
    this.speed = speed;
    this.damage = damage;
    this.round = round;
    this.target = -1;
    this.path.length = 0;
    this.pathCursor = 0;
    this.repathTimer = 0;
    this.attackCooldown = 0;
    this.tearCooldown = 0;
    this.climbing = false;
    this.stateTimer = 0;
    this.gait = Math.random() * Math.PI * 2;
    this.facing = 0;
  }

  /** @returns true when this hit killed it. */
  applyDamage(amount: number): boolean {
    if (this.state === 'dead') return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.state = 'dead';
      this.stateTimer = 0;
      return true;
    }
    this.state = 'hurt';
    this.stateTimer = 0;
    return false;
  }
}
