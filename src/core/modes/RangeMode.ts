import * as THREE from 'three';
import { EffectsSystem } from '../../effects/EffectsSystem';
import { CameraRig } from '../../player/CameraRig';
import { Player, type MoveIntent } from '../../player/Player';
import { ShootingRange } from '../../range/ShootingRange';
import { TargetField } from '../../range/TargetField';
import { Environment } from '../../rendering/Environment';
import { SceneScanner } from '../../shooting/SceneScanner';
import { ShootingSystem } from '../../shooting/ShootingSystem';
import { SessionStats } from '../../stats/SessionStats';
import { Hud, type HudState } from '../../ui/Hud';
import { ScopeOverlay } from '../../ui/ScopeOverlay';
import { clamp, DEG2RAD } from '../../utils/math';
import { WeaponSystem } from '../../weapons/WeaponSystem';
import { ViewModel } from '../../weapons/viewmodel/ViewModel';
import { resolveLoadout } from '../../loadout/loadout';
import type { GameMode, ModeContext } from './GameMode';

const CROSSHAIR_MIN_RADIUS = 4;
const CROSSHAIR_MAX_RADIUS = 140;

/**
 * The shooting range: lanes, steel plates and score keeping. Owns its own
 * world scene and the frame order for range gameplay.
 */
export class RangeMode implements GameMode {
  readonly id = 'range' as const;
  readonly world = new THREE.Scene();

  private readonly environment: Environment;
  private readonly range: ShootingRange;
  private readonly targets: TargetField;
  private readonly scanner: SceneScanner;
  private readonly player: Player;
  private readonly cameraRig: CameraRig;
  private readonly viewModel: ViewModel;
  private readonly effects: EffectsSystem;

  private readonly stats = new SessionStats();
  private readonly shooting: ShootingSystem;
  private readonly weapons: WeaponSystem;
  private readonly hud: Hud;
  private readonly scope: ScopeOverlay;

  private readonly intent: MoveIntent = { forward: 0, right: 0 };
  private readonly hudState: HudState = {
    ammo: 0,
    magazineSize: 0,
    fireMode: '',
    aimDistance: null,
    accuracy: 0,
    hits: 0,
    shots: 0,
    bestHit: 0,
    crosshairRadius: 8,
    hideCrosshair: false,
    reloading: false,
    empty: false,
    fps: 60,
  };

  constructor(private readonly context: ModeContext) {
    this.environment = new Environment(this.world);
    this.range = new ShootingRange(this.world);
    this.targets = new TargetField(this.world);
    this.scanner = new SceneScanner([...this.range.colliders, ...this.targets.colliders]);

    this.player = new Player(this.range.obstacles);
    this.cameraRig = new CameraRig(context.render.camera);
    this.viewModel = new ViewModel(context.render.viewScene);
    this.effects = new EffectsSystem(this.world);

    this.shooting = new ShootingSystem({
      camera: context.render.camera,
      viewModel: this.viewModel,
      scanner: this.scanner,
      effects: this.effects,
      audio: context.audio,
      stats: this.stats,
    });
    this.shooting.onTargetHit = (info) => this.hud.flashHit(info.offCenter < 0.25);

    this.weapons = new WeaponSystem({
      cameraRig: this.cameraRig,
      viewModel: this.viewModel,
      shooting: this.shooting,
      audio: context.audio,
      loadout: resolveLoadout(context.loadout),
      // A range hands out ammo; the limit belongs to the mansion, not here.
      infiniteReserve: true,
    });

    this.hud = new Hud(context.container);
    this.scope = new ScopeOverlay(context.container);

    this.syncWeaponHud();
    context.render.refreshShadows();
  }

  swapWeapon(): void {
    this.weapons.swap();
    this.syncWeaponHud();
  }

  setActive(active: boolean): void {
    this.hud.setVisible(active);
    if (active) return;
    this.weapons.setTrigger(false);
    this.weapons.setAds(false);
    this.scope.setVisible(false);
  }

  dispose(): void {
    this.hud.dispose();
    this.scope.dispose();
    this.viewModel.dispose();
    this.effects.dispose();
    this.targets.dispose();
    this.range.dispose();
    this.environment.dispose();
  }

  update(dt: number): void {
    this.simulate(dt);
    this.updateHud();
  }

  private simulate(dt: number): void {
    const input = this.context.input;

    this.handleActionKeys();

    this.weapons.setTrigger(input.isFiring);
    this.weapons.setAds(input.isAiming);

    const lookX = input.lookDeltaX;
    const lookY = input.lookDeltaY;
    this.cameraRig.applyLook(lookX, lookY, this.weapons.lookSensitivity);

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
    this.targets.update(dt);
    this.effects.update(dt, this.shooting.ballistics, this.context.render.camera.quaternion);
    this.scope.setVisible(this.weapons.isScoped);
  }

  private handleActionKeys(): void {
    const input = this.context.input;

    if (input.wasKeyPressed('KeyQ')) {
      this.weapons.swap();
      this.syncWeaponHud();
    }

    if (input.wasKeyPressed('KeyR')) this.weapons.requestReload();
    if (input.wasKeyPressed('KeyB')) this.weapons.toggleFireMode();
    if (input.wasKeyPressed('KeyT')) {
      this.targets.resetAll();
      this.stats.reset();
      this.effects.clear();
    }
  }

  private syncWeaponHud(): void {
    const definition = this.weapons.current.definition;
    const scope = definition.ads.scope;
    const subtitle = scope ? `${definition.caliber} · ${scope.magnificationLabel}` : definition.caliber;
    this.hud.setWeapon(definition.name, subtitle);
  }

  private updateHud(): void {
    const weapon = this.weapons.current;
    const state = this.hudState;

    state.ammo = weapon.ammo;
    state.magazineSize = weapon.magazineSize;
    state.fireMode = weapon.fireMode === 'auto' ? 'AUTO' : 'SEMI';
    state.aimDistance = this.shooting.aimDistance;
    state.accuracy = this.stats.accuracy;
    state.hits = this.stats.hitCount;
    state.shots = this.stats.shotsFired;
    state.bestHit = this.stats.longestHitDistance;
    state.crosshairRadius = this.crosshairRadius();
    state.hideCrosshair = this.weapons.adsProgress > 0.55;
    state.reloading = weapon.isReloading;
    state.empty = weapon.isEmpty;
    state.fps = this.context.fps();

    this.hud.update(state);
  }

  /** Converts the current cone half angle into a screen space radius. */
  private crosshairRadius(): number {
    const camera = this.context.render.camera;
    const halfHeight = window.innerHeight * 0.5;
    const halfFov = Math.tan(camera.fov * DEG2RAD * 0.5);
    const pixels = (Math.tan(this.weapons.spreadAngle) / halfFov) * halfHeight;
    return clamp(pixels + CROSSHAIR_MIN_RADIUS, CROSSHAIR_MIN_RADIUS, CROSSHAIR_MAX_RADIUS);
  }
}
