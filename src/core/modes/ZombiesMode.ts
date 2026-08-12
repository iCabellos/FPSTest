import * as THREE from 'three';
import { EffectsSystem } from '../../effects/EffectsSystem';
import { resolveLoadout } from '../../loadout/loadout';
import { Mansion } from '../../map/Mansion';
import { WALL_HEIGHT } from '../../map/layout';
import { CameraRig } from '../../player/CameraRig';
import { Player, type MoveIntent } from '../../player/Player';
import type { BoxObstacle } from '../../range/ShootingRange';
import { SceneScanner } from '../../shooting/SceneScanner';
import { ShootingSystem } from '../../shooting/ShootingSystem';
import { RoundManager } from '../../rounds/RoundManager';
import { SessionStats } from '../../stats/SessionStats';
import { ZombiesHud, type ZombiesHudState } from '../../ui/ZombiesHud';
import { WeaponSystem } from '../../weapons/WeaponSystem';
import { ViewModel } from '../../weapons/viewmodel/ViewModel';
import { ZombieManager, type ZombieTarget } from '../../zombies/ZombieManager';
import { ZombieScanner } from '../../zombies/ZombieScanner';
import type { GameMode, ModeContext } from './GameMode';

const START_POINTS = 500;
const POINTS_PER_HIT = 10;
const POINTS_PER_KILL = 60;
const MAX_HEALTH = 150;
/** Seconds without damage before health starts coming back. */
const REGEN_DELAY = 4.5;
const REGEN_RATE = 22;
const INTERACT_RANGE = 3.4;
const BANNER_TIME = 2.6;

const tmpForward = new THREE.Vector3();
const tmpToBarrier = new THREE.Vector3();
const tmpAimPoint = new THREE.Vector3();
const tmpEye = new THREE.Vector3();
/** How hard touch aim assist pulls onto a walker. */
const AIM_ASSIST_STRENGTH = 7;
const AIM_ASSIST_RANGE = 45;

/**
 * Zombies survival. Owns the mansion, the horde, the round clock and the
 * player's economy, and wires them to the shared weapon and shooting systems.
 */
export class ZombiesMode implements GameMode {
  readonly id = 'zombies' as const;
  readonly world = new THREE.Scene();

  private readonly mansion: Mansion;
  private readonly player: Player;
  private readonly cameraRig: CameraRig;
  private readonly viewModel: ViewModel;
  private readonly effects: EffectsSystem;
  private readonly stats = new SessionStats();
  private readonly worldScanner: SceneScanner;
  private readonly scanner: ZombieScanner;
  private readonly shooting: ShootingSystem;
  private readonly weapons: WeaponSystem;
  private readonly zombies: ZombieManager;
  private readonly rounds = new RoundManager();
  private readonly hud: ZombiesHud;

  private readonly intent: MoveIntent = { forward: 0, right: 0 };
  private readonly colliders: THREE.Object3D[] = [];
  private readonly obstacles: BoxObstacle[] = [];
  private readonly targets: ZombieTarget[] = [];

  private points = START_POINTS;
  private health = MAX_HEALTH;
  private sinceDamage = 0;
  private banner: string | null = null;
  private bannerTimer = 0;
  private dead = false;
  /** Cached so the HUD object is not rebuilt every frame. */
  private readonly hudState: ZombiesHudState = {
    round: 1,
    points: START_POINTS,
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    weaponName: '',
    ammo: 0,
    magazineSize: 0,
    zombiesLeft: 0,
    prompt: null,
    promptAffordable: true,
    banner: null,
    fps: 60,
  };

  constructor(private readonly context: ModeContext) {
    this.world.fog = new THREE.FogExp2(0x0d1014, 0.012);
    this.world.background = new THREE.Color(0x10151b);
    this.buildLighting();

    this.mansion = new Mansion(this.world);
    // The map is flat and sealed, so the walker needs no ground sampling and
    // is contained by real walls rather than an invisible box.
    this.player = new Player(this.mansion.collectObstacles(this.obstacles), null, false);
    this.player.position.set(this.mansion.playerSpawn.x, 0, this.mansion.playerSpawn.z);

    this.cameraRig = new CameraRig(context.render.camera);
    this.viewModel = new ViewModel(context.render.viewScene);
    this.effects = new EffectsSystem(this.world);

    this.zombies = new ZombieManager(this.world, this.mansion.nav, this.mansion.isBarrierOpen);
    this.zombies.onPlayerHit = (_index, damage) => this.takeDamage(damage);

    this.worldScanner = new SceneScanner(this.mansion.collectColliders(this.colliders));
    this.scanner = new ZombieScanner(this.worldScanner, this.zombies);

    this.shooting = new ShootingSystem({
      camera: context.render.camera,
      viewModel: this.viewModel,
      scanner: this.scanner,
      effects: this.effects,
      audio: context.audio,
      stats: this.stats,
      resolveImpact: () => this.resolveImpact(),
    });

    this.weapons = new WeaponSystem({
      cameraRig: this.cameraRig,
      viewModel: this.viewModel,
      shooting: this.shooting,
      audio: context.audio,
      loadout: resolveLoadout(context.loadout),
    });

    this.hud = new ZombiesHud(context.container);
    this.targets.push({ position: this.player.position, alive: true });

    this.rounds.onRoundStart = (round) => this.showBanner(`ROUND ${round}`);
    this.rounds.begin();

    context.render.refreshShadows();
  }

  swapWeapon(): void {
    this.weapons.swap();
  }

  setActive(active: boolean): void {
    this.hud.setVisible(active);
    if (active) return;
    this.weapons.setTrigger(false);
    this.weapons.setAds(false);
  }

  update(dt: number): void {
    if (this.dead) {
      this.updateHud(dt);
      return;
    }

    const input = this.context.input;

    if (input.wasKeyPressed('KeyQ')) this.weapons.swap();
    if (input.wasKeyPressed('KeyR')) this.weapons.requestReload();
    if (input.wasKeyPressed('KeyB')) this.weapons.toggleFireMode();
    if (input.wasKeyPressed('KeyF')) this.tryPurchase();

    this.weapons.setTrigger(input.isFiring);
    this.weapons.setAds(input.isAiming);

    const lookX = input.lookDeltaX;
    const lookY = input.lookDeltaY;
    this.cameraRig.applyLook(lookX, lookY, this.weapons.lookSensitivity);
    if (input.wantsAimAssist) this.applyAimAssist(dt);

    this.intent.forward = input.moveForward;
    this.intent.right = input.moveRight;
    this.player.update(dt, this.intent, this.cameraRig.yaw, this.weapons.movementMultiplier);

    const moveFraction = this.player.speedFraction;
    this.weapons.updateAim(dt, moveFraction);
    this.cameraRig.update(
      dt,
      this.player.position,
      this.player.eyeHeight,
      this.player.lean,
      this.weapons.recoilPitch,
      this.weapons.recoilYaw,
    );
    this.weapons.updateFiring(dt, moveFraction, lookX, lookY);

    this.shooting.update(dt);
    this.mansion.update(dt);
    this.updateSpawning(dt);
    this.targets[0] = { position: this.player.position, alive: !this.dead };
    this.zombies.update(dt, this.targets);
    this.rounds.update(dt);
    this.effects.update(dt, this.shooting.ballistics, this.context.render.camera.quaternion);

    this.updateHealth(dt);
    this.updateHud(dt);
  }

  dispose(): void {
    this.hud.dispose();
    this.viewModel.dispose();
    this.effects.dispose();
    this.zombies.dispose();
    this.mansion.dispose();
  }

  // ------------------------------------------------------------------ combat

  /** Called by the shooting system when a round lands. */
  private resolveImpact(): boolean {
    const zombie = this.scanner.lastZombie;
    if (!zombie) return false;

    const damage = this.weapons.current.definition.projectile.damage;
    const killed = zombie.applyDamage(damage);
    this.points += killed ? POINTS_PER_KILL : POINTS_PER_HIT;
    if (killed) {
      this.rounds.registerKill();
      this.stats.recordHit(0);
    }
    this.hud.flashHit();
    return true;
  }

  /**
   * Touch aim assist: pull onto the closest walker in front of the player so a
   * thumb does not have to track a moving target.
   */
  private applyAimAssist(dt: number): void {
    tmpEye.set(this.player.position.x, this.player.eyeHeight, this.player.position.z);
    this.context.render.camera.getWorldDirection(tmpForward);

    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;
    this.zombies.forEachAlive((zombie) => {
      tmpAimPoint.copy(zombie.position);
      tmpAimPoint.y += 1.2;
      tmpToBarrier.subVectors(tmpAimPoint, tmpEye);
      const distance = tmpToBarrier.length();
      if (distance > AIM_ASSIST_RANGE || distance < 0.5) return;
      tmpToBarrier.divideScalar(distance);
      const facing = tmpToBarrier.dot(tmpForward);
      // Only assist toward things roughly ahead, nearest first.
      if (facing < 0.2) return;
      const score = facing * 2 - distance / AIM_ASSIST_RANGE;
      if (score > bestScore) {
        bestScore = score;
        best = tmpAimPoint.clone();
      }
    });

    if (best) this.cameraRig.aimAt(best, tmpEye, dt, AIM_ASSIST_STRENGTH);
  }

  private takeDamage(damage: number): void {
    if (this.dead) return;
    this.health -= damage;
    this.sinceDamage = 0;
    this.cameraRig.addShake(0.6);
    if (this.health > 0) return;

    this.health = 0;
    this.dead = true;
    this.weapons.setTrigger(false);
    this.showBanner(`YOU DIED — ROUND ${this.rounds.round}`, 999);
    this.zombies.clear();
  }

  private updateHealth(dt: number): void {
    this.sinceDamage += dt;
    if (this.sinceDamage < REGEN_DELAY || this.health >= MAX_HEALTH) return;
    this.health = Math.min(MAX_HEALTH, this.health + REGEN_RATE * dt);
  }

  private updateSpawning(dt: number): void {
    if (!this.rounds.shouldSpawn(dt)) return;

    const node = this.pickSpawnNode();
    if (node === null) return;

    const round = this.rounds.round;
    const spawned = this.zombies.spawn(node, {
      // Tougher and faster each round, with a ceiling on speed.
      health: 90 + (round - 1) * 28,
      speed: Math.min(3.6, 1.5 + round * 0.11),
      damage: 18 + Math.min(20, round * 1.5),
      round,
    });
    if (spawned) this.rounds.registerSpawn();
  }

  /**
   * Spawns come from open parts of the map, preferring somewhere the player
   * is not standing so walkers do not appear on top of them.
   */
  private pickSpawnNode(): THREE.Vector3 | null {
    const nav = this.mansion.nav;
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;

    for (const id of this.mansion.spawnNodes) {
      const node = nav.node(id);
      // Only spawn where a route to the player actually exists.
      const path = nav.findPath(id, nav.nearest(this.player.position), this.mansion.isBarrierOpen);
      if (!path) continue;

      const distance = node.position.distanceTo(this.player.position);
      if (distance < 6) continue;
      const score = -Math.abs(distance - 18) + Math.random() * 4;
      if (score > bestScore) {
        bestScore = score;
        best = node.position;
      }
    }
    return best;
  }

  // -------------------------------------------------------------- purchasing

  /** Nearest closed barrier the player is standing at and looking toward. */
  private findBarrierInReach(): { id: string; label: string; cost: number } | null {
    this.context.render.camera.getWorldDirection(tmpForward);
    for (const barrier of this.mansion.barriers) {
      if (barrier.isOpen) continue;
      tmpToBarrier.copy(barrier.config.position).sub(this.player.position);
      tmpToBarrier.y -= 1;
      const distance = tmpToBarrier.length();
      if (distance > INTERACT_RANGE) continue;
      tmpToBarrier.divideScalar(distance);
      if (tmpToBarrier.dot(tmpForward) < 0.35) continue;
      return { id: barrier.id, label: barrier.config.label, cost: barrier.config.cost };
    }
    return null;
  }

  private tryPurchase(): void {
    const reachable = this.findBarrierInReach();
    if (!reachable) return;

    const barrier = this.mansion.barrier(reachable.id);
    // The host validates all three: barrier exists, still shut, and affordable.
    if (!barrier || barrier.isOpen) return;
    if (this.points < reachable.cost) {
      this.context.audio.play('dryFire', 0.7);
      return;
    }

    this.points -= reachable.cost;
    barrier.open();
    this.context.audio.play('charge', 1);
    this.showBanner(`${reachable.label} OPEN`);
    // Opening a route changes what bullets and bodies can pass through.
    this.mansion.collectColliders(this.colliders);
    this.mansion.collectObstacles(this.obstacles);
  }

  // --------------------------------------------------------------------- ui

  private showBanner(text: string, seconds = BANNER_TIME): void {
    this.banner = text;
    this.bannerTimer = seconds;
  }

  private updateHud(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner = null;
    }

    const weapon = this.weapons.current;
    const reachable = this.dead ? null : this.findBarrierInReach();
    const state = this.hudState;

    state.round = this.rounds.round;
    state.points = Math.floor(this.points);
    state.health = Math.round(this.health);
    state.weaponName = weapon.definition.name;
    state.ammo = weapon.ammo;
    state.magazineSize = weapon.magazineSize;
    const snapshot = this.rounds.snapshot;
    state.zombiesLeft = snapshot.zombiesToKill - snapshot.zombiesKilled;
    state.prompt = reachable ? `[F] ${reachable.label} — $${reachable.cost}` : null;
    state.promptAffordable = reachable === null || this.points >= reachable.cost;
    state.banner = this.banner;
    state.fps = this.context.fps();

    this.hud.update(state);
  }

  private buildLighting(): void {
    // An interior with a ceiling gets no sky, so the ambient and hemisphere
    // terms carry the room and the lamps only add mood on top.
    this.world.add(new THREE.HemisphereLight(0x8ea3bb, 0x40342a, 2.4));
    this.world.add(new THREE.AmbientLight(0x6f7d8c, 1.05));

    const key = new THREE.DirectionalLight(0xdbe6f4, 1.15);
    key.position.set(14, 12, 16);
    key.target.position.set(-4, 0, -8);
    this.world.add(key, key.target);

    const rim = new THREE.DirectionalLight(0xffb277, 0.5);
    rim.position.set(-16, 9, -18);
    this.world.add(rim);

    // Failing lamps hanging in each wing: warm pools that pick out the rooms
    // and give the place somewhere to walk toward.
    const lamps: Array<[number, number, number]> = [
      [0, 10, 0xffcf8a],
      [0, 1, 0xffcf8a],
      [-12, 6, 0xffb877],
      [12, 6, 0xffb877],
      [-12, -7, 0xff9d6a],
      [12, -7, 0xff9d6a],
      [0, -9, 0xbfd4ff],
      [0, -18, 0x9fc4ff],
    ];
    for (const [x, z, colour] of lamps) {
      const lamp = new THREE.PointLight(colour, 14, 16, 2);
      lamp.position.set(x, WALL_HEIGHT - 0.5, z);
      this.world.add(lamp);
    }
  }
}
