import type { AudioSystem, SoundId } from '../audio/AudioSystem';
import { CAMERA } from '../core/constants';
import type { CameraRig } from '../player/CameraRig';
import { RecoilSystem } from '../shooting/RecoilSystem';
import type { ShootingSystem } from '../shooting/ShootingSystem';
import { SpreadModel } from '../shooting/SpreadModel';
import { lerp } from '../utils/math';
import type { WeaponDefinition, WeaponId } from './WeaponDefinition';
import { Weapon } from './Weapon';
import type { ViewModel } from './viewmodel/ViewModel';

export interface WeaponSystemDeps {
  cameraRig: CameraRig;
  viewModel: ViewModel;
  shooting: ShootingSystem;
  audio: AudioSystem;
  /** The weapons carried into this match, in slot order. */
  loadout: readonly WeaponDefinition[];
  /** True at the range, where ammo is free and unlimited. */
  infiniteReserve?: boolean;
  /**
   * Lets a mode take over a shot before ballistics see it. Return true when
   * the shot was handled and no bullet should leave the barrel — the special
   * weapon spins reels instead of firing.
   */
  onShot?: (weapon: Weapon) => boolean;
}

/** How many weapons can be carried at once. */
export const MAX_SLOTS = 2;

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/**
 * Sounds fired as the reload animation passes each stage, so the magazine
 * seating and the action closing are heard when they are seen. The magazine
 * release plays as the reload starts.
 */
const RELOAD_CUES: ReadonlyArray<{ at: number; id: SoundId; volume: number }> = [
  { at: 0.7, id: 'magIn', volume: 1 },
  { at: 0.86, id: 'charge', volume: 0.9 },
];

/**
 * Owns the loadout and everything that shapes how a weapon feels: ADS blend,
 * recoil, spread and the view model. Firing itself is delegated to the
 * shooting system.
 */
export class WeaponSystem {
  private readonly weapons: Weapon[];
  private readonly recoil = new RecoilSystem();
  private readonly spread = new SpreadModel();

  private index = 0;
  private adsHeld = false;
  private adsFactor = 0;
  private currentSpread = 0;
  private reloadCue = 0;

  constructor(private readonly deps: WeaponSystemDeps) {
    this.weapons = deps.loadout.map(
      (definition) => new Weapon(definition, deps.infiniteReserve ?? false),
    );
    this.deps.viewModel.setWeapon(this.current.definition);
    this.current.onEquip();
  }

  /** True when this weapon is already in a slot. */
  carries(id: WeaponId): boolean {
    return this.weapons.some((weapon) => weapon.definition.id === id);
  }

  /**
   * Hands over a weapon bought off a wall or pulled from the mystery box.
   *
   * Buying one you already carry just tops it up. Otherwise it fills the free
   * slot, and once both slots are full it replaces the one in your hands —
   * which is what makes choosing what to hold at the box actually matter.
   */
  giveWeapon(definition: WeaponDefinition): void {
    const existing = this.weapons.findIndex((weapon) => weapon.definition.id === definition.id);
    if (existing >= 0) {
      this.weapons[existing].refillReserve();
      this.selectSlot(existing);
      return;
    }

    const fresh = new Weapon(definition, this.deps.infiniteReserve ?? false);
    if (this.weapons.length < MAX_SLOTS) {
      this.weapons.push(fresh);
      this.selectSlot(this.weapons.length - 1);
      return;
    }

    this.current.onHolster();
    this.weapons[this.index] = fresh;
    this.equipCurrent();
  }

  /** Refills the spare ammo of whatever is in hand. */
  refillCurrentAmmo(): void {
    this.current.refillReserve();
    this.deps.audio.play('magIn', 0.9);
  }

  get current(): Weapon {
    return this.weapons[this.index];
  }

  /** Eased 0..1 ADS blend used by the camera, view model and spread. */
  get adsProgress(): number {
    return this.adsFactor;
  }

  get isScoped(): boolean {
    const scope = this.current.definition.ads.scope;
    return scope !== undefined && this.adsFactor >= scope.hideViewModelAt;
  }

  /** Current cone half angle in radians, for the crosshair. */
  get spreadAngle(): number {
    return this.currentSpread;
  }

  get movementMultiplier(): number {
    const definition = this.current.definition;
    return lerp(definition.movementMultiplier, definition.adsMovementMultiplier, this.adsFactor);
  }

  get lookSensitivity(): number {
    return lerp(1, this.current.definition.ads.sensitivityMultiplier, this.adsFactor);
  }

  setTrigger(down: boolean): void {
    this.current.setTrigger(down);
  }

  setAds(down: boolean): void {
    this.adsHeld = down;
  }

  requestReload(): void {
    if (!this.current.requestReload()) return;
    this.reloadCue = 0;
    this.deps.audio.play('magOut');
  }

  toggleFireMode(): void {
    if (this.current.toggleFireMode()) this.deps.audio.play('switch', 0.7);
  }

  get slotCount(): number {
    return this.weapons.length;
  }

  /** Cycles to the next carried weapon. Used by the swap key and by touch. */
  swap(): void {
    if (this.weapons.length < 2) return;
    this.selectSlot((this.index + 1) % this.weapons.length);
  }

  selectSlot(slot: number): void {
    if (slot === this.index || slot < 0 || slot >= this.weapons.length) return;

    this.current.onHolster();
    this.index = slot;
    this.equipCurrent();
  }

  private equipCurrent(): void {
    const weapon = this.current;
    weapon.onEquip();
    this.deps.viewModel.setWeapon(weapon.definition);
    this.recoil.reset();
    this.spread.reset();
    this.adsFactor = 0;
    this.deps.cameraRig.resetFov(CAMERA.baseFov);
    this.deps.audio.play('switch');
  }

  /**
   * Springs, blends and camera driven state. Runs before the camera transform
   * is composed so recoil and FOV are applied this frame.
   */
  updateAim(dt: number, moveFraction: number): void {
    const definition = this.current.definition;

    const canAim = !this.current.isEquipping;
    const target = this.adsHeld && canAim ? 1 : 0;
    this.adsFactor = moveTowards(this.adsFactor, target, dt / Math.max(0.01, definition.ads.time));

    this.recoil.update(dt, definition.recoil);
    this.spread.update(dt, definition.spread);
    this.currentSpread = this.spread.compute(definition.spread, this.adsFactor, moveFraction);

    this.deps.cameraRig.setFovTarget(lerp(CAMERA.baseFov, definition.ads.fov, this.adsFactor));
  }

  get recoilPitch(): number {
    return this.recoil.offsetPitch;
  }

  get recoilYaw(): number {
    return this.recoil.offsetYaw;
  }

  /**
   * Weapon timers, shots and view model animation. Runs after the camera has
   * been composed so rounds leave along the exact aim of this frame.
   */
  updateFiring(dt: number, moveFraction: number, lookDeltaX: number, lookDeltaY: number): void {
    const weapon = this.current;
    const definition = weapon.definition;
    const result = weapon.update(dt);

    if (result.shots > 0) this.emitShots(result.shots, weapon, moveFraction);
    if (result.boltCycled) this.deps.audio.play('bolt');
    if (result.dryFired) this.deps.audio.play('dryFire');
    this.updateReloadCues(weapon, result.reloadFinished);

    const scoped = this.isScoped;
    this.deps.viewModel.setVisible(!scoped);
    this.deps.viewModel.update(dt, {
      adsFactor: this.adsFactor,
      moveFraction,
      lookDeltaX,
      lookDeltaY,
      weapon,
    });

    // Recompute after firing so the crosshair reflects the bloom immediately.
    this.currentSpread = this.spread.compute(definition.spread, this.adsFactor, moveFraction);
  }

  private updateReloadCues(weapon: Weapon, finished: boolean): void {
    if (finished) {
      // A very long frame can jump past a cue; the reload still has to be heard.
      this.playReloadCuesFrom(1);
      this.reloadCue = 0;
      return;
    }
    if (!weapon.isReloading) {
      this.reloadCue = 0;
      return;
    }
    this.playReloadCuesFrom(weapon.reloadProgress);
  }

  private playReloadCuesFrom(progress: number): void {
    while (this.reloadCue < RELOAD_CUES.length && progress >= RELOAD_CUES[this.reloadCue].at) {
      const cue = RELOAD_CUES[this.reloadCue];
      this.deps.audio.play(cue.id, cue.volume);
      this.reloadCue++;
    }
  }

  private emitShots(shots: number, weapon: Weapon, moveFraction: number): void {
    const definition = weapon.definition;
    const adsRecoilScale = lerp(1, definition.ads.recoilMultiplier, this.adsFactor);
    const firstIndex = weapon.burstIndex - shots;

    for (let i = 0; i < shots; i++) {
      // Recomputed per round so bloom applies within a single frame too.
      const cone = this.spread.compute(definition.spread, this.adsFactor, moveFraction);
      if (!this.deps.onShot?.(weapon)) this.deps.shooting.fire(weapon, cone);
      this.spread.addShot(definition.spread);

      const impulse = this.recoil.fire(definition.recoil, firstIndex + i, adsRecoilScale);
      this.deps.cameraRig.addAimOffset(impulse.permanentPitch, impulse.permanentYaw);
      this.deps.cameraRig.addShake(impulse.shake * 0.4);
      this.deps.viewModel.applyKick(impulse.kickback, impulse.punch);
    }
  }
}
