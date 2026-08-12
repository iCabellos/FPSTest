import type { FireMode, WeaponDefinition } from './WeaponDefinition';

/** Guard against catch-up bursts after a long frame. */
const MAX_SHOTS_PER_UPDATE = 4;
/** Idle time after which the recoil pattern index resets. */
const BURST_RESET_DELAY = 0.35;

export interface WeaponTickResult {
  shots: number;
  reloadFinished: boolean;
  boltCycled: boolean;
  dryFired: boolean;
}

/**
 * Pure runtime state of a single weapon: ammo, cadence, fire mode, reload and
 * bolt cycle. Deliberately free of rendering or input concerns so the timing
 * rules can be unit tested.
 */
export class Weapon {
  private ammoInMagazine: number;
  private fireModeIndex = 0;
  private cooldown = 0;
  private reloadTimer = 0;
  private boltTimer = 0;
  private equipTimer = 0;
  private triggerDown = false;
  /** A semi-auto pull only produces one shot until the trigger is released. */
  private triggerConsumed = false;
  private burstShots = 0;
  private idleTime = BURST_RESET_DELAY;
  /** Reused every update so the hot path allocates nothing. */
  private readonly result: WeaponTickResult = {
    shots: 0,
    reloadFinished: false,
    boltCycled: false,
    dryFired: false,
  };

  constructor(readonly definition: WeaponDefinition) {
    this.ammoInMagazine = definition.magazineSize;
  }

  get ammo(): number {
    return this.ammoInMagazine;
  }

  get magazineSize(): number {
    return this.definition.magazineSize;
  }

  get fireMode(): FireMode {
    return this.definition.fireModes[this.fireModeIndex];
  }

  get isReloading(): boolean {
    return this.reloadTimer > 0;
  }

  get isCyclingBolt(): boolean {
    return this.boltTimer > 0;
  }

  get isEquipping(): boolean {
    return this.equipTimer > 0;
  }

  get isEmpty(): boolean {
    return this.ammoInMagazine === 0;
  }

  /** Shots fired in the current burst; drives recoil pattern and spread. */
  get burstIndex(): number {
    return this.burstShots;
  }

  /** 0..1 progress of an active reload, for the view model animation. */
  get reloadProgress(): number {
    if (this.reloadTimer <= 0) return 0;
    return 1 - this.reloadTimer / this.definition.reloadTime;
  }

  /** 0..1 progress of the draw animation; 1 when fully deployed. */
  get equipProgress(): number {
    if (this.equipTimer <= 0) return 1;
    return 1 - this.equipTimer / this.definition.equipTime;
  }

  /** 0..1 progress of the bolt cycle. */
  get boltProgress(): number {
    const cycleTime = this.definition.boltCycleTime;
    if (!cycleTime || this.boltTimer <= 0) return 0;
    return 1 - this.boltTimer / cycleTime;
  }

  get shotInterval(): number {
    return 60 / this.definition.rpm;
  }

  setTrigger(down: boolean): void {
    if (!down) this.triggerConsumed = false;
    this.triggerDown = down;
  }

  /** Returns true when a reload actually starts. */
  requestReload(): boolean {
    if (this.isReloading || this.isEquipping) return false;
    if (this.ammoInMagazine >= this.definition.magazineSize) return false;
    this.reloadTimer = this.definition.reloadTime;
    this.boltTimer = 0;
    return true;
  }

  /** Returns true when the weapon supports more than one mode and switched. */
  toggleFireMode(): boolean {
    if (this.definition.fireModes.length < 2) return false;
    this.fireModeIndex = (this.fireModeIndex + 1) % this.definition.fireModes.length;
    // Only swallow the pull that is actually in progress.
    if (this.triggerDown) this.triggerConsumed = true;
    return true;
  }

  /** Called when the weapon is drawn; cancels any pending action. */
  onEquip(): void {
    this.equipTimer = this.definition.equipTime;
    this.reloadTimer = 0;
    this.boltTimer = 0;
    this.cooldown = 0;
    this.burstShots = 0;
    this.idleTime = BURST_RESET_DELAY;
    this.triggerConsumed = true;
  }

  /** Called when the weapon is holstered. */
  onHolster(): void {
    this.reloadTimer = 0;
    this.boltTimer = 0;
    this.triggerDown = false;
    this.triggerConsumed = false;
  }

  update(dt: number): WeaponTickResult {
    const result = this.result;
    result.shots = 0;
    result.reloadFinished = false;
    result.boltCycled = false;
    result.dryFired = false;

    this.cooldown -= dt;
    this.equipTimer = Math.max(0, this.equipTimer - dt);

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        this.ammoInMagazine = this.definition.magazineSize;
        this.burstShots = 0;
        result.reloadFinished = true;
      }
    }

    if (this.boltTimer > 0) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.boltTimer = 0;
        result.boltCycled = true;
      }
    }

    this.idleTime += dt;
    if (this.idleTime >= BURST_RESET_DELAY && this.burstShots > 0) this.burstShots = 0;

    // Overshoot is carried while a burst is running so the average cadence
    // matches the rpm instead of quantising to the frame rate. Outside a burst
    // it is dropped, otherwise the first rounds after a pause would double up.
    const firing = this.canFire() && this.wantsToFire() && !this.isEmpty;
    if (!firing && this.cooldown < 0) this.cooldown = 0;

    if (!this.canFire()) return result;

    while (result.shots < MAX_SHOTS_PER_UPDATE && this.cooldown <= 0 && this.wantsToFire()) {
      if (this.isEmpty) {
        if (!this.triggerConsumed) {
          this.triggerConsumed = true;
          result.dryFired = true;
        }
        break;
      }

      this.ammoInMagazine--;
      this.cooldown += this.shotInterval;
      this.burstShots++;
      this.idleTime = 0;
      result.shots++;

      if (this.fireMode === 'semi') this.triggerConsumed = true;
      if (this.definition.boltCycleTime) {
        this.boltTimer = this.definition.boltCycleTime;
        break;
      }
      if (this.fireMode === 'semi') break;
    }

    return result;
  }

  private canFire(): boolean {
    return !this.isReloading && !this.isCyclingBolt && !this.isEquipping;
  }

  private wantsToFire(): boolean {
    if (!this.triggerDown) return false;
    if (this.fireMode === 'auto') return true;
    return !this.triggerConsumed;
  }
}
