export const MOUSE_LEFT = 0;
export const MOUSE_RIGHT = 2;

/**
 * Browsers can deliver a huge movement value right after pointer lock engages,
 * which would fling the view. Anything past this is dropped.
 */
const MAX_MOVEMENT_PER_EVENT = 180;

/**
 * Some browsers recentre the cursor when the lock is acquired and report the
 * jump as ordinary movement, sometimes split across several events. Motion is
 * ignored for this long after locking, which is imperceptible to the player.
 */
const LOCK_SETTLE_MS = 150;

import type { TouchState } from './TouchControls';

type Listener = { target: EventTarget; type: string; fn: EventListener };

/**
 * Keyboard + mouse state with pointer lock handling. Accumulated mouse motion
 * is consumed once per frame so look input never depends on event frequency.
 */
export class Input {
  private readonly keys = new Set<string>();
  private readonly keysPressedThisFrame = new Set<string>();
  private readonly buttons = new Set<number>();
  private readonly buttonsPressedThisFrame = new Set<number>();
  private readonly listeners: Listener[] = [];

  private lookX = 0;
  private lookY = 0;
  private locked = false;
  private ignoreMovementUntil = 0;

  onLockChange: ((locked: boolean) => void) | null = null;
  /** Set when the device has thumb sticks; folded into the readings below. */
  private touch: TouchState | null = null;

  constructor(private readonly element: HTMLElement) {
    this.on(window, 'keydown', (e) => this.handleKeyDown(e as KeyboardEvent));
    this.on(window, 'keyup', (e) => this.handleKeyUp(e as KeyboardEvent));
    this.on(window, 'blur', () => this.clearTransientState());
    this.on(document, 'mousemove', (e) => this.handleMouseMove(e as MouseEvent));
    this.on(document, 'mousedown', (e) => this.handleMouseDown(e as MouseEvent));
    this.on(document, 'mouseup', (e) => this.handleMouseUp(e as MouseEvent));
    this.on(document, 'contextmenu', (e) => e.preventDefault());
    this.on(document, 'pointerlockchange', () => this.handleLockChange());
  }

  get isLocked(): boolean {
    return this.locked;
  }

  attachTouch(state: TouchState | null): void {
    this.touch = state;
  }

  get lookDeltaX(): number {
    return this.lookX + (this.touch?.lookX ?? 0);
  }

  get lookDeltaY(): number {
    return this.lookY + (this.touch?.lookY ?? 0);
  }

  /** -1..1 forward axis, from the keys or the left stick. */
  get moveForward(): number {
    const keys = (this.isKeyDown('KeyW') ? 1 : 0) - (this.isKeyDown('KeyS') ? 1 : 0);
    return keys !== 0 ? keys : (this.touch?.moveY ?? 0);
  }

  /** -1..1 strafe axis. */
  get moveRight(): number {
    const keys = (this.isKeyDown('KeyD') ? 1 : 0) - (this.isKeyDown('KeyA') ? 1 : 0);
    return keys !== 0 ? keys : (this.touch?.moveX ?? 0);
  }

  /** True while the fire stick has been held past its delay. */
  get isFiring(): boolean {
    return this.isButtonDown(MOUSE_LEFT) || (this.touch?.firing ?? false);
  }

  /** True from the moment the fire stick is pressed, so aim can snap early. */
  get isAiming(): boolean {
    return this.isButtonDown(MOUSE_RIGHT) || (this.touch?.aiming ?? false);
  }

  /** Only touch requests assisted aim; a mouse player aims for themselves. */
  get wantsAimAssist(): boolean {
    return this.touch?.aiming ?? false;
  }

  requestPointerLock(): void {
    void this.element.requestPointerLock();
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasKeyPressed(code: string): boolean {
    return this.keysPressedThisFrame.has(code);
  }

  isButtonDown(button: number): boolean {
    return this.buttons.has(button);
  }

  wasButtonPressed(button: number): boolean {
    return this.buttonsPressedThisFrame.has(button);
  }

  /** Clears per-frame edges and mouse deltas. Call at the end of each frame. */
  endFrame(): void {
    this.keysPressedThisFrame.clear();
    this.buttonsPressedThisFrame.clear();
    this.lookX = 0;
    this.lookY = 0;
  }

  dispose(): void {
    for (const { target, type, fn } of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.clearTransientState();
  }

  private on(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.listeners.push({ target, type, fn });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    this.keys.add(event.code);
    this.keysPressedThisFrame.add(event.code);
    // Space and slash scroll the page; the game never wants that.
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code);
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.locked) return;
    if (performance.now() < this.ignoreMovementUntil) return;
    if (Math.abs(event.movementX) > MAX_MOVEMENT_PER_EVENT) return;
    if (Math.abs(event.movementY) > MAX_MOVEMENT_PER_EVENT) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.locked) return;
    this.buttons.add(event.button);
    this.buttonsPressedThisFrame.add(event.button);
  }

  private handleMouseUp(event: MouseEvent): void {
    this.buttons.delete(event.button);
  }

  private handleLockChange(): void {
    this.locked = document.pointerLockElement === this.element;
    if (this.locked) this.ignoreMovementUntil = performance.now() + LOCK_SETTLE_MS;
    if (!this.locked) this.clearTransientState();
    this.onLockChange?.(this.locked);
  }

  private clearTransientState(): void {
    this.keys.clear();
    this.buttons.clear();
    this.keysPressedThisFrame.clear();
    this.buttonsPressedThisFrame.clear();
    this.lookX = 0;
    this.lookY = 0;
  }
}
