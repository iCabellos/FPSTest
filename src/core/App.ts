import { AudioSystem } from '../audio/AudioSystem';
import { RenderContext } from '../rendering/RenderContext';
import { disposeGeneratedTextures } from '../rendering/textures';
import { installViewLighting } from '../rendering/ViewLighting';
import {
  DEFAULT_RANGE_LOADOUT,
  DEFAULT_ZOMBIES_LOADOUT,
  type Loadout,
} from '../loadout/loadout';
import { LoadoutScreen, type LoadoutKind } from '../ui/LoadoutScreen';
import { MainMenu, type MenuAction } from '../ui/MainMenu';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import type { GameMode, ModeContext } from './modes/GameMode';
import { RangeMode } from './modes/RangeMode';
import { ZombiesMode } from './modes/ZombiesMode';

/**
 * Application shell. Owns the renderer, input, audio and the frame loop, and
 * swaps whole game modes in and out. Nothing here knows how a mode plays.
 */
export class App {
  private readonly render: RenderContext;
  private readonly input: Input;
  private readonly audio = new AudioSystem();
  private readonly loop: GameLoop;
  private readonly menu: MainMenu;
  private readonly loadoutScreen: LoadoutScreen;
  private readonly context: ModeContext;

  private mode: GameMode | null = null;
  private loadout: Loadout = { ...DEFAULT_RANGE_LOADOUT };
  private pendingMode: LoadoutKind = 'range';
  /** Set while a mode is loaded, so losing pointer lock pauses it. */
  private paused = false;

  constructor(container: HTMLElement) {
    this.render = new RenderContext(container);
    installViewLighting(this.render.viewScene);

    this.input = new Input(this.render.domElement);
    this.input.onLockChange = (locked) => this.handleLockChange(locked);

    this.loop = new GameLoop((dt) => this.frame(dt));

    this.context = {
      render: this.render,
      input: this.input,
      audio: this.audio,
      container,
      fps: () => this.loop.fps,
      exitToMenu: () => this.exitToMenu(),
      loadout: this.loadout,
    };

    this.menu = new MainMenu(container, {
      onAction: (action) => this.handleMenuAction(action),
      onResume: () => this.requestLock(),
      onQuit: () => this.exitToMenu(),
    });

    this.loadoutScreen = new LoadoutScreen(container, {
      onDeploy: (loadout) => this.deploy(loadout),
      onBack: () => {
        this.loadoutScreen.close();
        this.menu.openRoot();
      },
    });
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.unloadMode();
    this.menu.dispose();
    this.loadoutScreen.dispose();
    this.input.dispose();
    this.audio.dispose();
    disposeGeneratedTextures();
    this.render.dispose();
  }

  private handleMenuAction(action: MenuAction): void {
    this.audio.resume();
    this.pendingMode = action.kind === 'range' ? 'range' : 'zombies';
    this.menu.close();
    this.loadoutScreen.open(
      this.pendingMode,
      this.pendingMode === 'range' ? DEFAULT_RANGE_LOADOUT : DEFAULT_ZOMBIES_LOADOUT,
    );
  }

  private deploy(loadout: Loadout): void {
    this.loadout.primary = loadout.primary;
    this.loadout.secondary = loadout.secondary;
    this.loadoutScreen.close();
    this.loadMode(
      this.pendingMode === 'range' ? new RangeMode(this.context) : new ZombiesMode(this.context),
    );
    this.requestLock();
  }

  private loadMode(mode: GameMode): void {
    this.unloadMode();
    this.mode = mode;
    this.render.setWorld(mode.world);
  }

  private unloadMode(): void {
    if (!this.mode) return;
    this.mode.dispose();
    this.mode = null;
    this.render.setWorld(null);
  }

  private exitToMenu(): void {
    document.exitPointerLock();
    this.unloadMode();
    this.loadoutScreen.close();
    this.menu.openRoot();
  }

  private requestLock(): void {
    if (!this.mode) return;
    this.menu.close();
    this.input.requestPointerLock();
  }

  private handleLockChange(locked: boolean): void {
    this.paused = !locked;
    this.mode?.setActive(locked);
    if (locked) {
      this.menu.close();
      return;
    }
    // A mode is still loaded, so offer to resume rather than dropping it.
    if (this.mode) this.menu.openPause();
    else if (!this.loadoutScreen.isOpen) this.menu.openRoot();
  }

  private frame(dt: number): void {
    if (this.mode && !this.paused) this.mode.update(dt);
    this.render.render(this.mode !== null);
    this.input.endFrame();
  }
}
