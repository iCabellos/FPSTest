import { AudioSystem } from '../audio/AudioSystem';
import { EffectsSystem } from '../effects/EffectsSystem';
import { CameraRig } from '../player/CameraRig';
import { Player, type MoveIntent } from '../player/Player';
import { ShootingRange } from '../range/ShootingRange';
import { TargetField } from '../range/TargetField';
import { Environment } from '../rendering/Environment';
import { RenderContext } from '../rendering/RenderContext';
import { disposeGeneratedTextures } from '../rendering/textures';
import { SceneScanner } from '../shooting/SceneScanner';
import { ShootingSystem } from '../shooting/ShootingSystem';
import { SessionStats } from '../stats/SessionStats';
import { Hud, type HudState } from '../ui/Hud';
import { ScopeOverlay } from '../ui/ScopeOverlay';
import { StartScreen } from '../ui/StartScreen';
import { clamp, DEG2RAD } from '../utils/math';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { ViewModel } from '../weapons/viewmodel/ViewModel';
import { GameLoop } from './GameLoop';
import { Input, MOUSE_LEFT, MOUSE_RIGHT } from './Input';

const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
const CROSSHAIR_MIN_RADIUS = 4;
const CROSSHAIR_MAX_RADIUS = 140;

/**
 * Wires the systems together and owns the frame order. Everything else stays
 * unaware of the others.
 */
export class Game {
  private readonly render: RenderContext;
  private readonly environment: Environment;
  private readonly range: ShootingRange;
  private readonly targets: TargetField;
  private readonly scanner: SceneScanner;
  private readonly player: Player;
  private readonly cameraRig: CameraRig;
  private readonly viewModel: ViewModel;
  private readonly effects: EffectsSystem;
  private readonly audio = new AudioSystem();
  private readonly stats = new SessionStats();
  private readonly shooting: ShootingSystem;
  private readonly weapons: WeaponSystem;
  private readonly hud: Hud;
  private readonly scope: ScopeOverlay;
  private readonly startScreen: StartScreen;
  private readonly input: Input;
  private readonly loop: GameLoop;

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

  constructor(container: HTMLElement) {
    this.render = new RenderContext(container);
    this.environment = new Environment(this.render.scene, this.render.viewScene);
    this.range = new ShootingRange(this.render.scene);
    this.targets = new TargetField(this.render.scene);
    this.scanner = new SceneScanner([...this.range.colliders, ...this.targets.colliders]);

    this.player = new Player(this.range.obstacles);
    this.cameraRig = new CameraRig(this.render.camera);
    this.viewModel = new ViewModel(this.render.viewScene);
    this.effects = new EffectsSystem(this.render.scene);

    this.shooting = new ShootingSystem({
      camera: this.render.camera,
      viewModel: this.viewModel,
      scanner: this.scanner,
      effects: this.effects,
      audio: this.audio,
      stats: this.stats,
    });
    this.shooting.onTargetHit = (info) => this.hud.flashHit(info.offCenter < 0.25);

    this.weapons = new WeaponSystem({
      cameraRig: this.cameraRig,
      viewModel: this.viewModel,
      shooting: this.shooting,
      audio: this.audio,
    });

    this.hud = new Hud(container);
    this.scope = new ScopeOverlay(container);
    this.startScreen = new StartScreen(container, () => this.requestStart());

    this.input = new Input(this.render.domElement);
    this.input.onLockChange = (locked) => this.handleLockChange(locked);

    this.loop = new GameLoop((dt) => this.frame(dt));

    this.syncWeaponHud();
    this.render.refreshShadows();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.hud.dispose();
    this.scope.dispose();
    this.startScreen.dispose();
    this.viewModel.dispose();
    this.effects.dispose();
    this.targets.dispose();
    this.range.dispose();
    this.environment.dispose();
    this.audio.dispose();
    disposeGeneratedTextures();
    this.render.dispose();
  }

  private requestStart(): void {
    this.audio.resume();
    this.input.requestPointerLock();
  }

  private handleLockChange(locked: boolean): void {
    this.hud.setVisible(locked);
    if (locked) {
      this.startScreen.hide();
      return;
    }
    this.weapons.setTrigger(false);
    this.weapons.setAds(false);
    this.scope.setVisible(false);
    this.startScreen.show(true);
  }

  private frame(dt: number): void {
    if (this.input.isLocked) {
      this.simulate(dt);
      this.updateHud();
    }
    this.render.render();
    this.input.endFrame();
  }

  private simulate(dt: number): void {
    const input = this.input;

    this.handleActionKeys();

    this.weapons.setTrigger(input.isButtonDown(MOUSE_LEFT));
    this.weapons.setAds(input.isButtonDown(MOUSE_RIGHT));

    const lookX = input.lookDeltaX;
    const lookY = input.lookDeltaY;
    this.cameraRig.applyLook(lookX, lookY, this.weapons.lookSensitivity);

    this.intent.forward = (input.isKeyDown('KeyW') ? 1 : 0) - (input.isKeyDown('KeyS') ? 1 : 0);
    this.intent.right = (input.isKeyDown('KeyD') ? 1 : 0) - (input.isKeyDown('KeyA') ? 1 : 0);
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
    this.effects.update(dt, this.shooting.ballistics, this.render.camera.quaternion);
    this.scope.setVisible(this.weapons.isScoped);
  }

  private handleActionKeys(): void {
    const input = this.input;

    for (let slot = 0; slot < WEAPON_KEYS.length; slot++) {
      if (input.wasKeyPressed(WEAPON_KEYS[slot])) {
        this.weapons.selectSlot(slot);
        this.syncWeaponHud();
      }
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
    state.fps = this.loop.fps;

    this.hud.update(state);
  }

  /** Converts the current cone half angle into a screen space radius. */
  private crosshairRadius(): number {
    const camera = this.render.camera;
    const halfHeight = window.innerHeight * 0.5;
    const halfFov = Math.tan(camera.fov * DEG2RAD * 0.5);
    const pixels = (Math.tan(this.weapons.spreadAngle) / halfFov) * halfHeight;
    return clamp(pixels + CROSSHAIR_MIN_RADIUS, CROSSHAIR_MIN_RADIUS, CROSSHAIR_MAX_RADIUS);
  }
}
