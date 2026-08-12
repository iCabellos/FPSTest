import { AudioSystem } from '../audio/AudioSystem';
import { RenderContext } from '../rendering/RenderContext';
import { disposeGeneratedTextures } from '../rendering/textures';
import { installViewLighting } from '../rendering/ViewLighting';
import { MainMenu, type MenuAction } from '../ui/MainMenu';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import type { GameMode, ModeContext } from './modes/GameMode';
import { RangeMode } from './modes/RangeMode';

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
  private readonly context: ModeContext;

  private mode: GameMode | null = null;
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
    };

    this.menu = new MainMenu(container, {
      onAction: (action) => this.handleMenuAction(action),
      onResume: () => this.requestLock(),
      onQuit: () => this.exitToMenu(),
    });
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.unloadMode();
    this.menu.dispose();
    this.input.dispose();
    this.audio.dispose();
    disposeGeneratedTextures();
    this.render.dispose();
  }

  private handleMenuAction(action: MenuAction): void {
    this.audio.resume();
    if (action.kind === 'range') {
      this.loadMode(new RangeMode(this.context));
      this.requestLock();
    }
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
    else this.menu.openRoot();
  }

  private frame(dt: number): void {
    if (this.mode && !this.paused) this.mode.update(dt);
    this.render.render(this.mode !== null);
    this.input.endFrame();
  }
}
