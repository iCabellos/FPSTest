import * as THREE from 'three';
import { GRAVITY, PLAYER } from '../core/constants';
import type { BoxObstacle } from '../range/ShootingRange';
import { clamp } from '../utils/math';

export interface MoveIntent {
  /** -1 back, +1 forward. */
  forward: number;
  /** -1 left, +1 right. */
  right: number;
}

/**
 * Supplies the walkable floor height under a point. Multi storey maps provide
 * one; the flat shooting range does not need to.
 */
export interface GroundSampler {
  /**
   * @param currentY the walker's current feet height, so overlapping floors
   * can resolve to the one it is actually standing on.
   * @returns floor height, or null when there is nothing to stand on.
   */
  sampleHeight(x: number, z: number, currentY: number): number | null;
}

const tmpWish = new THREE.Vector3();

/**
 * Grounded walker constrained to the firing stall. No jumping or crouching:
 * the range only needs lateral movement between lanes.
 */
export class Player {
  readonly position = new THREE.Vector3(0, 0, 3.8);
  readonly velocity = new THREE.Vector3();

  private bobPhase = 0;
  private bobHeight = 0;
  private strafeLean = 0;
  /** Feet height. Stays 0 on flat maps. */
  private groundY = 0;
  private verticalVelocity = 0;

  constructor(
    private readonly obstacles: readonly BoxObstacle[],
    private readonly ground: GroundSampler | null = null,
    /** The range keeps the player inside the stall; maps use walls instead. */
    private readonly clampToBounds = true,
  ) {}

  /** Current speed as a fraction of the base walk speed, for spread scaling. */
  get speedFraction(): number {
    return Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / PLAYER.walkSpeed);
  }

  get lean(): number {
    return this.strafeLean;
  }

  get eyeHeight(): number {
    return this.groundY + PLAYER.eyeHeight + this.bobHeight;
  }

  /** Feet height, for spawning and for zombie targeting. */
  get feetHeight(): number {
    return this.groundY;
  }

  /** Places the walker, e.g. at a map spawn point. */
  teleport(x: number, y: number, z: number): void {
    this.position.set(x, 0, z);
    this.groundY = y;
    this.verticalVelocity = 0;
    this.velocity.set(0, 0, 0);
  }

  update(dt: number, intent: MoveIntent, yaw: number, speedMultiplier: number): void {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Camera looks down -Z at yaw 0.
    tmpWish.set(
      intent.right * cos - intent.forward * sin,
      0,
      -intent.right * sin - intent.forward * cos,
    );

    const wishLengthSq = tmpWish.lengthSq();
    const maxSpeed = PLAYER.walkSpeed * speedMultiplier;

    if (wishLengthSq > 1e-6) {
      tmpWish.normalize();
      this.velocity.addScaledVector(tmpWish, PLAYER.acceleration * dt);
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    } else {
      const drop = Math.exp(-PLAYER.friction * dt);
      this.velocity.x *= drop;
      this.velocity.z *= drop;
      if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
      if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
    }

    this.position.addScaledVector(this.velocity, dt);
    this.resolveCollisions();
    this.updateVertical(dt);
    this.updateViewBob(dt, intent.right);
  }

  /**
   * Falls onto the floor below and steps up onto low ledges. Ramps stand in
   * for staircases, so no explicit step climbing is needed.
   */
  private updateVertical(dt: number): void {
    if (!this.ground) return;

    const target = this.ground.sampleHeight(this.position.x, this.position.z, this.groundY);
    if (target === null) {
      // Nothing underneath: keep falling and let the map bounds catch it.
      this.verticalVelocity -= GRAVITY * dt;
      this.groundY += this.verticalVelocity * dt;
      return;
    }

    if (this.groundY <= target + PLAYER.stepHeight) {
      this.groundY = target;
      this.verticalVelocity = 0;
      return;
    }

    this.verticalVelocity -= GRAVITY * dt;
    this.groundY += this.verticalVelocity * dt;
    if (this.groundY < target) {
      this.groundY = target;
      this.verticalVelocity = 0;
    }
  }

  private resolveCollisions(): void {
    const { bounds, radius } = PLAYER;
    if (!this.clampToBounds) {
      this.resolveObstacles();
      return;
    }
    if (this.position.x < bounds.minX + radius) {
      this.position.x = bounds.minX + radius;
      this.velocity.x = 0;
    } else if (this.position.x > bounds.maxX - radius) {
      this.position.x = bounds.maxX - radius;
      this.velocity.x = 0;
    }
    if (this.position.z < bounds.minZ + radius) {
      this.position.z = bounds.minZ + radius;
      this.velocity.z = 0;
    } else if (this.position.z > bounds.maxZ - radius) {
      this.position.z = bounds.maxZ - radius;
      this.velocity.z = 0;
    }

    this.resolveObstacles();
  }

  private resolveObstacles(): void {
    const { radius } = PLAYER;
    for (const box of this.obstacles) {
      const nearestX = clamp(this.position.x, box.minX, box.maxX);
      const nearestZ = clamp(this.position.z, box.minZ, box.maxZ);
      const dx = this.position.x - nearestX;
      const dz = this.position.z - nearestZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= radius * radius) continue;

      if (distanceSq > 1e-8) {
        const distance = Math.sqrt(distanceSq);
        const push = (radius - distance) / distance;
        this.position.x += dx * push;
        this.position.z += dz * push;
      } else {
        // Dead centre of the box: eject along the shallowest axis.
        const toLeft = this.position.x - box.minX;
        const toRight = box.maxX - this.position.x;
        const toBack = this.position.z - box.minZ;
        const toFront = box.maxZ - this.position.z;
        const minimum = Math.min(toLeft, toRight, toBack, toFront);
        if (minimum === toLeft) this.position.x = box.minX - radius;
        else if (minimum === toRight) this.position.x = box.maxX + radius;
        else if (minimum === toBack) this.position.z = box.minZ - radius;
        else this.position.z = box.maxZ + radius;
      }
      this.velocity.multiplyScalar(0.4);
    }
  }

  private updateViewBob(dt: number, strafe: number): void {
    const fraction = this.speedFraction;
    this.bobPhase += dt * PLAYER.bobFrequency * fraction;
    const wave = Math.sin(this.bobPhase * 2) * PLAYER.bobAmplitude * fraction;
    this.bobHeight += (wave - this.bobHeight) * Math.min(1, dt * 18);

    const leanTarget = -strafe * 0.012;
    this.strafeLean += (leanTarget - this.strafeLean) * Math.min(1, dt * 6);
  }
}
