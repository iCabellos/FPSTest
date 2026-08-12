import type { AudioSystem } from '../audio/AudioSystem';
import { CAMERA } from '../core/constants';
import type { CameraRig } from '../player/CameraRig';
import { RecoilSystem } from '../shooting/RecoilSystem';
import type { ShootingSystem } from '../shooting/ShootingSystem';
import { SpreadModel } from '../shooting/SpreadModel';
import { lerp } from '../utils/math';
import { WEAPON_LOADOUT } from './definitions';
import { Weapon } from './Weapon';
import type { ViewModel } from './viewmodel/ViewModel';

export interface WeaponSystemDeps {
  cameraRig: CameraRig;
  viewModel: ViewModel;
  shooting: ShootingSystem;
  audio: AudioSystem;
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/**
 * Owns the loadout and everything that shapes how a weapon feels: ADS blend,
 * recoil, spread and the view model. Firing itself is delegated to the
 * shooting system.
 */
export class WeaponSystem {
  private readonly weapons: Weapon[] = WEAPON_LOADOUT.map((definition) => new Weapon(definition));
  private readonly recoil = new RecoilSystem();
  private readonly spread = new SpreadModel();

  private index = 0;
  private adsHeld = false;
  private adsFactor = 0;
  private currentSpread = 0;

  constructor(private readonly deps: WeaponSystemDeps) {
    this.deps.viewModel.setWeapon(this.current.definition);
    this.current.onEquip();
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
    if (this.current.requestReload()) this.deps.audio.play('reload');
  }

  toggleFireMode(): void {
    if (this.current.toggleFireMode()) this.deps.audio.play('switch', 0.7);
  }

  selectSlot(slot: number): void {
    if (slot === this.index || slot < 0 || slot >= this.weapons.length) return;

    this.current.onHolster();
    this.index = slot;

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
    if (result.reloadFinished) this.deps.audio.play('reloadEnd');
    if (result.boltCycled) this.deps.audio.play('bolt');
    if (result.dryFired) this.deps.audio.play('dryFire');

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

  private emitShots(shots: number, weapon: Weapon, moveFraction: number): void {
    const definition = weapon.definition;
    const adsRecoilScale = lerp(1, definition.ads.recoilMultiplier, this.adsFactor);
    const firstIndex = weapon.burstIndex - shots;

    for (let i = 0; i < shots; i++) {
      // Recomputed per round so bloom applies within a single frame too.
      const cone = this.spread.compute(definition.spread, this.adsFactor, moveFraction);
      this.deps.shooting.fire(weapon, cone);
      this.spread.addShot(definition.spread);

      const impulse = this.recoil.fire(definition.recoil, firstIndex + i, adsRecoilScale);
      this.deps.cameraRig.addAimOffset(impulse.permanentPitch, impulse.permanentYaw);
      this.deps.cameraRig.addShake(impulse.shake * 0.4);
      this.deps.viewModel.applyKick(impulse.kickback, impulse.punch);
    }
  }
}
