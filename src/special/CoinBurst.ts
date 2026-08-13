import * as THREE from 'three';

const GRAVITY = 11;
const LIFETIME = 2.2;
/** Energy kept after bouncing off the floor. */
const RESTITUTION = 0.42;
const RADIUS = 0.035;

const tmpMatrix = new THREE.Matrix4();
const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpScale = new THREE.Vector3(1, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

interface Coin {
  active: boolean;
  life: number;
  spin: number;
  spinRate: number;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
}

/**
 * Coins sprayed out of the slot machine's payout tray.
 *
 * Pure spectacle — they hit nothing and mean nothing — which is exactly why
 * they exist: a payout you can see bouncing off the floorboards sells the win
 * far better than a number going up. Pooled and drawn as one instanced mesh,
 * so a jackpot's worth of them costs a single draw call.
 */
export class CoinBurst {
  private readonly pool: Coin[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.Material;

  constructor(
    private readonly scene: THREE.Scene,
    readonly capacity = 90,
  ) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        active: false,
        life: 0,
        spin: 0,
        spinRate: 0,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
      });
    }

    this.material = new THREE.MeshPhongMaterial({
      color: 0xffd24a,
      emissive: 0x6a4a00,
      emissiveIntensity: 0.7,
      shininess: 130,
      specular: 0xfff3c0,
    });
    // A squashed cylinder reads as a coin from every angle.
    const geometry = new THREE.CylinderGeometry(RADIUS, RADIUS, RADIUS * 0.22, 10);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  get activeCount(): number {
    let count = 0;
    for (const coin of this.pool) if (coin.active) count++;
    return count;
  }

  /**
   * Throws a handful of coins out of a point, in a cone around a direction.
   *
   * @returns how many actually launched, which is fewer than asked for when
   *   the pool is already busy.
   */
  burst(origin: THREE.Vector3, direction: THREE.Vector3, count: number): number {
    let launched = 0;
    for (const coin of this.pool) {
      if (launched >= count) break;
      if (coin.active) continue;

      coin.active = true;
      coin.life = LIFETIME * (0.7 + Math.random() * 0.6);
      coin.spin = Math.random() * Math.PI * 2;
      coin.spinRate = 6 + Math.random() * 14;
      coin.position.copy(origin);
      // A wide, messy cone: a payout sprays, it does not aim.
      const speed = 2.2 + Math.random() * 3.4;
      coin.velocity
        .copy(direction)
        .normalize()
        .multiplyScalar(speed)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 2.6,
            1.4 + Math.random() * 2.4,
            (Math.random() - 0.5) * 2.6,
          ),
        );
      launched++;
    }
    return launched;
  }

  update(dt: number): void {
    for (const coin of this.pool) {
      if (!coin.active) continue;

      coin.velocity.y -= GRAVITY * dt;
      coin.position.addScaledVector(coin.velocity, dt);
      coin.spin += coin.spinRate * dt;

      if (coin.position.y <= RADIUS * 0.2) {
        coin.position.y = RADIUS * 0.2;
        coin.velocity.y = Math.abs(coin.velocity.y) * RESTITUTION;
        coin.velocity.x *= 0.72;
        coin.velocity.z *= 0.72;
        coin.spinRate *= 0.7;
      }

      coin.life -= dt;
      if (coin.life <= 0) coin.active = false;
    }
    this.render();
  }

  clear(): void {
    for (const coin of this.pool) coin.active = false;
    this.render();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }

  private render(): void {
    let index = 0;
    for (const coin of this.pool) {
      if (!coin.active) continue;
      tmpEuler.set(coin.spin, coin.spin * 0.7, coin.spin * 0.4);
      tmpQuaternion.setFromEuler(tmpEuler);
      tmpPosition.copy(coin.position);
      // Fade out by shrinking, so nothing pops when it expires.
      const fade = Math.min(1, coin.life / 0.4);
      tmpScale.setScalar(fade);
      tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
      this.mesh.setMatrixAt(index, tmpMatrix);
      index++;
    }
    for (let i = index; i < this.capacity; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
    tmpScale.setScalar(1);
  }
}
