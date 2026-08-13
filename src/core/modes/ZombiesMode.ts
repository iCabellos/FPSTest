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
import { GrenadeSwarm } from '../../special/GrenadeSwarm';
import { LaserReadout } from '../../special/LaserReadout';
import { NukeSequence } from '../../special/NukeSequence';
import { SlotMachine, type SlotSymbol } from '../../special/SlotMachine';
import { SessionStats } from '../../stats/SessionStats';
import { ZombiesHud, type ZombiesHudState } from '../../ui/ZombiesHud';
import type { WeaponDefinition } from '../../weapons/WeaponDefinition';
import { WEAPONS_BY_ID } from '../../weapons/definitions';
import { WeaponSystem } from '../../weapons/WeaponSystem';
import { ViewModel } from '../../weapons/viewmodel/ViewModel';
import { BOX_COST, MysteryBox } from '../../zombies/MysteryBox';
import { ZombieManager, type ZombieTarget } from '../../zombies/ZombieManager';
import { ZombieScanner } from '../../zombies/ZombieScanner';
import type { GameMode, ModeContext } from './GameMode';

const START_POINTS = 500;
const POINTS_PER_HIT = 10;
const POINTS_PER_HEADSHOT = 20;
const POINTS_PER_KILL = 60;
const POINTS_PER_HEADSHOT_KILL = 100;
/** Paid out once when the nuke lands. */
const POINTS_PER_NUKE = 400;
/** A round through the head hurts far more than one through the chest. */
const HEADSHOT_MULTIPLIER = 2.5;
const MAX_HEALTH = 150;
/** Seconds without damage before health starts coming back. */
const REGEN_DELAY = 4.5;
const REGEN_RATE = 22;
const INTERACT_RANGE = 3.4;
/** Range at which the mystery box can be used; it is a big object. */
const BOX_RANGE = 3.2;
const BANNER_TIME = 2.6;
/** How far in front of the muzzle the laser readout lands by default. */
const READOUT_DISTANCE = 3.2;

const tmpForward = new THREE.Vector3();
const tmpToTarget = new THREE.Vector3();
const tmpAimPoint = new THREE.Vector3();
const tmpEye = new THREE.Vector3();
const tmpMuzzle = new THREE.Vector3();
const tmpNormal = new THREE.Vector3(0, 1, 0);
/** How hard touch aim assist pulls onto a walker. */
const AIM_ASSIST_STRENGTH = 7;
const AIM_ASSIST_RANGE = 45;

/** Something the player can stand at and buy or take. */
type Interaction =
  | { kind: 'barrier'; id: string; label: string; cost: number }
  | { kind: 'wall'; id: string; label: string; cost: number }
  | { kind: 'box'; label: string; cost: number };

/**
 * Zombies survival. Owns the mansion, the horde, the round clock, the economy
 * and the special weapon, and wires them to the shared weapon and shooting
 * systems.
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
  private readonly box: MysteryBox;
  private readonly slot = new SlotMachine();
  private readonly grenades: GrenadeSwarm;
  private readonly nuke: NukeSequence;
  private readonly readout: LaserReadout;

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
  private reach: Interaction | null = null;
  /** Cached so the HUD object is not rebuilt every frame. */
  private readonly hudState: ZombiesHudState = {
    round: 1,
    points: START_POINTS,
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    weaponName: '',
    ammo: 0,
    reserve: 0,
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

    this.zombies = new ZombieManager(this.world, this.mansion.nav, this.mansion.isBarrierOpen, {
      isBoarded: this.mansion.isEntryBoarded,
      tear: this.mansion.tearEntry,
    });
    this.zombies.onPlayerHit = (_index, damage) => this.takeDamage(damage);
    // A plank coming off is a warning, not a reward: the splintering crack is
    // the whole point, and it is the only thing that tells you a window on the
    // far side of the house is about to open up.
    this.zombies.onBoardTorn = () => this.context.audio.play('boardTear', 0.8);

    this.box = new MysteryBox(
      this.mansion.boxRoom,
      this.mansion.boxPosition,
      this.mansion.propMaterials,
    );
    this.world.add(this.box.group);

    this.grenades = new GrenadeSwarm(this.world);
    this.nuke = new NukeSequence(this.world);
    this.readout = new LaserReadout(this.world);

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
      onShot: (weapon) =>
        weapon.definition.id === 'slotmachine' ? this.spinSpecial() : false,
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

    // The nuke owns the camera and the player while it plays out.
    if (this.nuke.isActive) {
      this.updateNuke(dt);
      return;
    }

    const input = this.context.input;

    if (input.wasKeyPressed('KeyQ')) this.weapons.swap();
    if (input.wasKeyPressed('KeyR')) this.weapons.requestReload();
    if (input.wasKeyPressed('KeyB')) this.weapons.toggleFireMode();
    if (input.wasKeyPressed('KeyF')) this.interact();

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
    this.reach = this.findInteraction();
    this.mansion.update(dt, this.reach?.kind === 'wall' ? this.reach.id : null);
    this.updateBox(dt);
    this.updateSpawning(dt);
    this.targets[0] = { position: this.player.position, alive: !this.dead };
    this.zombies.update(dt, this.targets);
    this.grenades.update(dt, (point, radius, damage) => this.explode(point, radius, damage));
    this.readout.update(dt);
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
    this.grenades.dispose();
    this.nuke.dispose();
    this.readout.dispose();
    this.box.dispose();
    this.mansion.dispose();
  }

  // ------------------------------------------------------------------ combat

  /** Called by the shooting system when a round lands. */
  private resolveImpact(): boolean {
    const zombie = this.scanner.lastZombie;
    if (!zombie) return false;

    const headshot = this.scanner.lastHeadshot;
    const base = this.weapons.current.definition.projectile.damage;
    const killed = zombie.applyDamage(base * (headshot ? HEADSHOT_MULTIPLIER : 1));

    if (killed) {
      this.points += headshot ? POINTS_PER_HEADSHOT_KILL : POINTS_PER_KILL;
      this.rounds.registerKill();
      this.stats.recordHit(0);
    } else {
      this.points += headshot ? POINTS_PER_HEADSHOT : POINTS_PER_HIT;
    }

    this.hud.flashHit();
    return true;
  }

  /**
   * Blast damage, falling off linearly to nothing at the edge. Used by the
   * grenades; the nuke does not go through here because it is not a radius
   * effect, it clears the round outright.
   */
  private explode(point: THREE.Vector3, radius: number, damage: number): void {
    this.effects.fireFlash(point, 4.5);
    this.effects.spawnImpact(point, tmpNormal, 4, true);
    this.context.audio.play('explosion', 1);

    const shake = Math.max(0, 1 - point.distanceTo(this.player.position) / (radius * 2.4));
    if (shake > 0) this.cameraRig.addShake(shake);

    this.zombies.forEachAlive((zombie) => {
      tmpAimPoint.copy(zombie.position);
      tmpAimPoint.y += 0.9;
      const distance = tmpAimPoint.distanceTo(point);
      if (distance > radius) return;
      const falloff = 1 - distance / radius;
      if (zombie.applyDamage(damage * falloff)) {
        this.points += POINTS_PER_KILL;
        this.rounds.registerKill();
      } else {
        this.points += POINTS_PER_HIT;
      }
    });
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
      tmpToTarget.subVectors(tmpAimPoint, tmpEye);
      const distance = tmpToTarget.length();
      if (distance > AIM_ASSIST_RANGE || distance < 0.5) return;
      tmpToTarget.divideScalar(distance);
      const facing = tmpToTarget.dot(tmpForward);
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
    this.grenades.clear();
  }

  private updateHealth(dt: number): void {
    this.sinceDamage += dt;
    if (this.sinceDamage < REGEN_DELAY || this.health >= MAX_HEALTH) return;
    this.health = Math.min(MAX_HEALTH, this.health + REGEN_RATE * dt);
  }

  // --------------------------------------------------------- special weapon

  /**
   * One pull of the lever. Every grenade the reels rolled is thrown on its own
   * bearing, and five nuclears trigger the jackpot.
   *
   * @returns true always: the special weapon never fires a bullet, so the
   *   shooting system must not be given the shot.
   */
  private spinSpecial(): boolean {
    const camera = this.context.render.camera;
    camera.getWorldDirection(tmpForward);
    // Bearing the first grenade flies on: straight ahead, clockwise from −Z.
    const bearing = (Math.atan2(tmpForward.x, -tmpForward.z) * 180) / Math.PI;

    const outcome = this.slot.spin(bearing);
    if (!outcome) return true;

    this.viewModel.getMuzzleWorld(camera, tmpMuzzle);
    for (const angle of outcome.grenadeAngles) this.grenades.launch(tmpMuzzle, angle);

    this.showReadout(outcome.symbols, outcome.pity, this.slot.isJackpotGuaranteed);
    this.context.audio.play('charge', outcome.jackpot ? 1 : 0.6);

    if (outcome.jackpot) {
      this.nuke.begin(this.player.position, camera);
      this.showBanner('NUCLEAR', 4);
    } else if (outcome.grenadeAngles.length === 0) {
      // Every reel a blank, or a lone nuclear: nothing happens, by design.
      this.context.audio.play('dryFire', 0.5);
    }
    return true;
  }

  /** Projects the spin onto whatever the weapon is pointing at. */
  private showReadout(
    symbols: readonly SlotSymbol[],
    pity: number,
    guaranteed: boolean,
  ): void {
    const camera = this.context.render.camera;
    camera.getWorldDirection(tmpForward);
    tmpEye.copy(camera.position);

    // Land the beams on the first surface, or hang them in the air if the room
    // is deeper than the projector reaches.
    const hit = this.scanner.measure(tmpEye, tmpForward, READOUT_DISTANCE + 0.4);
    const distance = hit === null ? READOUT_DISTANCE : Math.max(1.1, hit - 0.12);
    tmpAimPoint.copy(tmpEye).addScaledVector(tmpForward, distance);

    this.readout.show(tmpAimPoint, camera.quaternion, symbols, pity, guaranteed);
  }

  private updateNuke(dt: number): void {
    const detonated = this.nuke.update(dt);
    if (detonated) {
      // Only this round's walkers, exactly as the rule says.
      const killed = this.zombies.killRound(this.rounds.round);
      for (let i = 0; i < killed.length; i++) this.rounds.registerKill();
      this.points += POINTS_PER_NUKE;
      this.context.audio.play('explosion', 1);
      this.showBanner(`NUCLEAR — ${killed.length} DOWN`, 3);
    }

    this.zombies.update(dt, this.targets);
    this.grenades.update(dt, (point, radius, damage) => this.explode(point, radius, damage));
    this.readout.update(dt);
    this.mansion.update(dt);
    this.effects.update(dt, this.shooting.ballistics, this.context.render.camera.quaternion);
    this.nuke.applyCamera(this.context.render.camera);
    this.updateHud(dt);
  }

  // -------------------------------------------------------------- spawning

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
   * Spawns come from the lawn, never from inside the building.
   *
   * A lawn node only counts when an open route from it to the player exists,
   * and since the only edges through the shell are the windows, that route
   * always ends with a climb through one. Wings the player has not paid to
   * open are unreachable, so their windows stay quiet until the door is bought.
   */
  private pickSpawnNode(): THREE.Vector3 | null {
    const nav = this.mansion.nav;
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;

    for (const id of this.mansion.spawnNodes) {
      const path = nav.findPath(id, nav.nearest(this.player.position), this.mansion.isBarrierOpen);
      if (!path) continue;

      const node = nav.node(id);
      const distance = node.position.distanceTo(this.player.position);
      // Prefer the nearer lawn nodes, jittered so the horde does not queue up
      // at one window while the rest of the garden stands empty.
      const score = -distance + Math.random() * 22;
      if (score > bestScore) {
        bestScore = score;
        best = node.position;
      }
    }
    return best;
  }

  // -------------------------------------------------------------- purchasing

  /**
   * Nearest thing in reach the player is looking at. One query for all three
   * kinds, so the prompt and the purchase can never disagree about what is in
   * front of you.
   */
  private findInteraction(): Interaction | null {
    this.context.render.camera.getWorldDirection(tmpForward);

    let best: Interaction | null = null;
    let bestDistance = Infinity;

    const consider = (position: THREE.Vector3, range: number, build: () => Interaction): void => {
      tmpToTarget.copy(position).sub(this.player.position);
      tmpToTarget.y -= 1;
      const distance = tmpToTarget.length();
      if (distance > range || distance >= bestDistance) return;
      tmpToTarget.divideScalar(distance || 1);
      if (tmpToTarget.dot(tmpForward) < 0.35) return;
      bestDistance = distance;
      best = build();
    };

    for (const barrier of this.mansion.barriers) {
      if (barrier.isOpen) continue;
      consider(barrier.config.position, INTERACT_RANGE, () => ({
        kind: 'barrier',
        id: barrier.id,
        label: barrier.config.label,
        cost: barrier.config.cost,
      }));
    }

    for (const buy of this.mansion.wallBuys) {
      consider(buy.position, INTERACT_RANGE, () => {
        const owned = buy.spec.weapon ? this.weapons.carries(buy.spec.weapon) : false;
        const cost = buy.kind === 'ammo' || owned ? buy.refillCost : buy.cost;
        const label = buy.kind === 'ammo' ? 'AMMO' : owned ? `${buy.label} AMMO` : buy.label;
        return { kind: 'wall', id: buy.id, label, cost };
      });
    }

    const offered = this.box.offered;
    consider(this.box.position, BOX_RANGE, () =>
      offered
        ? { kind: 'box', label: `TAKE ${offered.name}`, cost: 0 }
        : { kind: 'box', label: 'MYSTERY BOX', cost: BOX_COST },
    );

    return best;
  }

  private interact(): void {
    const reach = this.reach;
    if (!reach) return;
    if (reach.kind === 'barrier') this.buyBarrier(reach);
    else if (reach.kind === 'wall') this.buyFromWall(reach);
    else this.useBox();
  }

  /** Spends points, or refuses audibly. @returns true when it went through. */
  private spend(cost: number): boolean {
    if (this.points < cost) {
      this.context.audio.play('dryFire', 0.7);
      return false;
    }
    this.points -= cost;
    return true;
  }

  private buyBarrier(reach: Interaction & { kind: 'barrier' }): void {
    const barrier = this.mansion.barrier(reach.id);
    // Validate all three: barrier exists, still shut, and affordable.
    if (!barrier || barrier.isOpen) return;
    if (!this.spend(reach.cost)) return;

    barrier.open();
    this.context.audio.play('charge', 1);
    this.showBanner(`${barrier.config.label} OPEN`);
    // Opening a route changes what bullets and bodies can pass through.
    this.mansion.collectColliders(this.colliders);
    this.mansion.collectObstacles(this.obstacles);
  }

  private buyFromWall(reach: Interaction & { kind: 'wall' }): void {
    const buy = this.mansion.wallBuys.find((candidate) => candidate.id === reach.id);
    if (!buy) return;

    if (buy.kind === 'ammo') {
      if (!this.spend(reach.cost)) return;
      this.weapons.refillCurrentAmmo();
      this.showBanner('AMMO RESTOCKED');
      return;
    }

    const weapon = buy.spec.weapon ? WEAPONS_BY_ID[buy.spec.weapon] : null;
    if (!weapon) return;
    if (!this.spend(reach.cost)) return;
    this.giveWeapon(weapon);
  }

  private useBox(): void {
    if (this.box.offered) {
      const weapon = this.box.take();
      if (weapon) this.giveWeapon(weapon);
      return;
    }
    if (this.box.isBusy) return;
    if (!this.spend(BOX_COST)) return;
    this.box.open();
    this.context.audio.play('switch', 0.9);
  }

  private giveWeapon(weapon: WeaponDefinition): void {
    // Re-buying the special weapon restores its uses and its pity counter.
    if (weapon.id === 'slotmachine') this.slot.reset();
    this.weapons.giveWeapon(weapon);
    this.showBanner(weapon.name);
  }

  private updateBox(dt: number): void {
    const granted = this.box.update(dt);
    // An offer that runs out is handed over rather than swallowed.
    if (granted) this.giveWeapon(granted);
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
    const reach = this.dead || this.nuke.isActive ? null : this.reach;
    const state = this.hudState;

    state.round = this.rounds.round;
    state.points = Math.floor(this.points);
    state.health = Math.round(this.health);
    state.weaponName = weapon.definition.name;
    state.ammo = weapon.ammo;
    state.reserve = weapon.reserve;
    state.magazineSize = weapon.magazineSize;
    const snapshot = this.rounds.snapshot;
    state.zombiesLeft = snapshot.zombiesToKill - snapshot.zombiesKilled;
    state.prompt = reach ? formatPrompt(reach) : null;
    state.promptAffordable = reach === null || this.points >= reach.cost;
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

function formatPrompt(reach: Interaction): string {
  return reach.cost > 0 ? `[F] ${reach.label} — $${reach.cost}` : `[F] ${reach.label}`;
}
