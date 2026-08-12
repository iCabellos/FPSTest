/** Live state the game reads each frame instead of listening for events. */
export interface TouchState {
  /** -1..1 movement, screen relative. */
  moveX: number;
  moveY: number;
  /** Look delta in the same units as mouse movement, consumed per frame. */
  lookX: number;
  lookY: number;
  /** True while the fire button is held and the delay has elapsed. */
  firing: boolean;
  /** True from the moment the fire button is touched, so aim can snap. */
  aiming: boolean;
}

export interface TouchHandlers {
  onSwapWeapon: () => void;
  onExit: () => void;
}

/** Seconds the fire button is held before it starts shooting. */
const FIRE_DELAY = 0.5;
/** Pixels from the stick origin that count as full deflection. */
const STICK_RADIUS = 62;
/** Deflection below this is treated as a tap, not a drag. */
const DEAD_ZONE = 6;

interface MoveStick {
  pointerId: number;
  originX: number;
  originY: number;
}

interface LookDrag {
  pointerId: number;
  lastX: number;
  lastY: number;
}

/**
 * Touch layout, mounted only on touchscreens.
 *
 * Left half: a movement stick that is invisible until a thumb lands on it and
 * appears wherever you press. Right half: drag anywhere to look around, the
 * same way a mouse moves the camera. On top of that sit three always visible
 * buttons — fire, swap weapon, and exit — so nothing depends on remembering an
 * invisible hotspot.
 *
 * The fire button aims the moment it is pressed and opens fire half a second
 * later, so a thumb never has to track a target.
 */
export class TouchControls {
  readonly state: TouchState = {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    firing: false,
    aiming: false,
  };

  private readonly root = document.createElement('div');
  private readonly moveZone = document.createElement('div');
  private readonly lookZone = document.createElement('div');
  private readonly moveRing = document.createElement('div');
  private readonly moveKnob = document.createElement('div');
  private readonly fireButton = document.createElement('button');

  private readonly listeners: Array<{ target: EventTarget; type: string; fn: EventListener }> = [];

  private moveStick: MoveStick | null = null;
  private lookDrag: LookDrag | null = null;
  private firePointer: number | null = null;
  private fireHeld = 0;

  constructor(container: HTMLElement, private readonly handlers: TouchHandlers) {
    this.root.className = 'touch';

    this.moveZone.className = 'touch__zone touch__zone--move';
    this.moveRing.className = 'touch__ring';
    this.moveKnob.className = 'touch__knob';
    this.moveRing.append(this.moveKnob);
    this.moveZone.append(this.moveRing);

    this.lookZone.className = 'touch__zone touch__zone--look';

    this.fireButton.type = 'button';
    this.fireButton.className = 'touch__button touch__button--fire';
    this.fireButton.textContent = 'FIRE';

    const swap = this.buildButton('touch__button touch__button--swap', 'SWAP', () =>
      this.handlers.onSwapWeapon(),
    );
    const exit = this.buildButton('touch__button touch__button--exit', 'MENU', () =>
      this.handlers.onExit(),
    );

    this.root.append(this.moveZone, this.lookZone, this.fireButton, swap, exit);
    container.append(this.root);

    // Movement and look live on their own halves; the fire button owns itself.
    this.on(this.moveZone, 'pointerdown', (e) => this.startMove(e as PointerEvent));
    this.on(this.lookZone, 'pointerdown', (e) => this.startLook(e as PointerEvent));
    this.on(this.fireButton, 'pointerdown', (e) => this.startFire(e as PointerEvent));
    this.on(window, 'pointermove', (e) => this.handleMove(e as PointerEvent));
    this.on(window, 'pointerup', (e) => this.handleUp(e as PointerEvent));
    this.on(window, 'pointercancel', (e) => this.handleUp(e as PointerEvent));
  }

  /** Touch input is only mounted when the device actually has a touchscreen. */
  static isTouchDevice(): boolean {
    return (
      typeof window !== 'undefined' &&
      (('ontouchstart' in window && navigator.maxTouchPoints > 0) ||
        window.matchMedia('(pointer: coarse)').matches)
    );
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('touch--active', visible);
    if (!visible) this.reset();
  }

  /** Advances the fire hold. Look deltas are cleared by {@link endFrame}. */
  update(dt: number): void {
    if (this.firePointer === null) {
      this.state.firing = false;
      this.state.aiming = false;
      return;
    }
    this.fireHeld += dt;
    this.state.aiming = true;
    this.state.firing = this.fireHeld >= FIRE_DELAY;
    this.fireButton.classList.toggle('touch__button--firing', this.state.firing);
  }

  endFrame(): void {
    this.state.lookX = 0;
    this.state.lookY = 0;
  }

  dispose(): void {
    for (const { target, type, fn } of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.root.remove();
  }

  private on(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn, { passive: false });
    this.listeners.push({ target, type, fn });
  }

  private buildButton(className: string, label: string, onTap: () => void): HTMLButtonElement {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    this.on(node, 'pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTap();
    });
    return node;
  }

  private startMove(event: PointerEvent): void {
    if (this.moveStick) return;
    event.preventDefault();
    this.moveStick = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY };
    this.moveRing.style.left = `${event.clientX}px`;
    this.moveRing.style.top = `${event.clientY}px`;
    this.moveZone.classList.add('touch__zone--held');
  }

  private startLook(event: PointerEvent): void {
    if (this.lookDrag) return;
    event.preventDefault();
    this.lookDrag = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
  }

  private startFire(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.firePointer !== null) return;
    this.firePointer = event.pointerId;
    this.fireHeld = 0;
    this.state.aiming = true;
    this.fireButton.classList.add('touch__button--held');
  }

  private handleMove(event: PointerEvent): void {
    if (this.moveStick?.pointerId === event.pointerId) {
      event.preventDefault();
      const dx = event.clientX - this.moveStick.originX;
      const dy = event.clientY - this.moveStick.originY;
      const distance = Math.hypot(dx, dy);
      const scale = distance > 0 ? Math.min(distance, STICK_RADIUS) / distance : 0;

      const live = distance > DEAD_ZONE;
      this.state.moveX = live ? (dx * scale) / STICK_RADIUS : 0;
      // Screen up is forward.
      this.state.moveY = live ? -(dy * scale) / STICK_RADIUS : 0;
      this.moveKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
      return;
    }

    if (this.lookDrag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    // Raw pixel deltas, exactly like a mouse, so the feel matches desktop.
    this.state.lookX += event.clientX - this.lookDrag.lastX;
    this.state.lookY += event.clientY - this.lookDrag.lastY;
    this.lookDrag.lastX = event.clientX;
    this.lookDrag.lastY = event.clientY;
  }

  private handleUp(event: PointerEvent): void {
    if (this.moveStick?.pointerId === event.pointerId) {
      this.moveStick = null;
      this.state.moveX = 0;
      this.state.moveY = 0;
      this.moveKnob.style.transform = '';
      this.moveZone.classList.remove('touch__zone--held');
    }
    if (this.lookDrag?.pointerId === event.pointerId) this.lookDrag = null;
    if (this.firePointer === event.pointerId) {
      this.firePointer = null;
      this.state.firing = false;
      this.state.aiming = false;
      this.fireButton.classList.remove('touch__button--held', 'touch__button--firing');
    }
  }

  private reset(): void {
    this.moveStick = null;
    this.lookDrag = null;
    this.firePointer = null;
    this.moveKnob.style.transform = '';
    this.moveZone.classList.remove('touch__zone--held');
    this.fireButton.classList.remove('touch__button--held', 'touch__button--firing');
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.state.lookX = 0;
    this.state.lookY = 0;
    this.state.firing = false;
    this.state.aiming = false;
  }
}
