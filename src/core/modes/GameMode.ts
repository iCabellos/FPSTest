import type * as THREE from 'three';
import type { AudioSystem } from '../../audio/AudioSystem';
import type { RenderContext } from '../../rendering/RenderContext';
import type { Loadout } from '../../loadout/loadout';
import type { Input } from '../Input';

export type GameModeId = 'range' | 'zombies';

/** Everything a mode is handed by the app shell. Modes never reach further. */
export interface ModeContext {
  render: RenderContext;
  input: Input;
  audio: AudioSystem;
  /** Overlay host for mode owned HUD elements. */
  container: HTMLElement;
  /** Smoothed frame rate, for the HUD readout. */
  fps: () => number;
  /** Hands control back to the menu. */
  exitToMenu: () => void;
  /** Weapons chosen on the loadout screen before the match started. */
  loadout: Loadout;
}

/**
 * A self contained game mode. The shell owns the renderer, input and audio;
 * each mode owns its own world scene and tears it down on exit.
 */
export interface GameMode {
  readonly id: GameModeId;
  /** The scene the shell should render for this mode. */
  readonly world: THREE.Scene;
  /** Advances one frame. Only called while the pointer is locked. */
  update(dt: number): void;
  /** Called when pointer lock is gained or lost, so modes can pause safely. */
  setActive(active: boolean): void;
  /** Swaps to the other carried weapon; driven by Q or the touch button. */
  swapWeapon(): void;
  dispose(): void;
}
