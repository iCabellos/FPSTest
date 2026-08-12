/** Live state the game reads each frame instead of listening for events. */
export interface TouchState {
  /** -1..1 movement, screen relative. */
  moveX: number;
  moveY: number;
  /** Look delta in the same units as mouse movement, consumed per frame. */
  lookX: number;
  lookY: number;
  /** True while the fire stick is held and the delay has elapsed. */
  firing: boolean;
  /** True from the moment the fire stick is touched, so aim can snap. */
  aiming: boolean;
}

/** Seconds the fire stick is held before it starts shooting. */
const FIRE_DELAY = 0.5;
/** Look is deliberately duller than a mouse: the stick also steers movement. */
const LOOK_SENSITIVITY = 2.6;
/** Pixels from the stick origin that count as full deflection. */
const STICK_RADIUS = 62;
/** Deflection below this is treated as a tap, not a drag. */
const DEAD_ZONE = 6;

interface Stick {
  pointerId: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  /** Seconds since the touch went down. */
  held: number;
  node: HTMLElement;
  knob: HTMLElement;
}

/**
 * Two thumb sticks that only exist on touch devices.
 *
 * Left stick moves, and is invisible until touched. The right stick aims: it
 * locks onto a target the moment it is pressed, opens fire half a second
 * later, and if you keep dragging it also swings the camera, at a lower
 * sensitivity than a mouse so the two do not fight each other.
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
  private readonly zones: Record<'move' | 'fire', HTMLElement>;
  private readonly sticks: { move: Stick | null; fire: Stick | null } = {
    move: null,
    fire: null,
  };

  private readonly listeners: Array<{ type: string; fn: EventListener }> = [];

  constructor(container: HTMLElement) {
    this.root.className = 'touch';
    this.zones = {
      move: this.buildZone('touch__zone touch__zone--move'),
      fire: this.buildZone('touch__zone touch__zone--fire'),
    };
    this.root.append(this.zones.move, this.zones.fire);
    container.append(this.root);

    this.on('pointerdown', (event) => this.handleDown(event as PointerEvent));
    this.on('pointermove', (event) => this.handleMove(event as PointerEvent));
    this.on('pointerup', (event) => this.handleUp(event as PointerEvent));
    this.on('pointercancel', (event) => this.handleUp(event as PointerEvent));
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

  /** Advances hold timers. Look deltas are cleared by {@link endFrame}. */
  update(dt: number): void {
    const fire = this.sticks.fire;
    if (!fire) {
      this.state.firing = false;
      this.state.aiming = false;
      return;
    }
    fire.held += dt;
    this.state.aiming = true;
    this.state.firing = fire.held >= FIRE_DELAY;
  }

  endFrame(): void {
    this.state.lookX = 0;
    this.state.lookY = 0;
  }

  dispose(): void {
    for (const { type, fn } of this.listeners) this.root.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.root.remove();
  }

  private on(type: string, fn: EventListener): void {
    this.root.addEventListener(type, fn, { passive: false });
    this.listeners.push({ type, fn });
  }

  private buildZone(className: string): HTMLElement {
    const zone = document.createElement('div');
    zone.className = className;
    const ring = document.createElement('div');
    ring.className = 'touch__ring';
    const knob = document.createElement('div');
    knob.className = 'touch__knob';
    ring.append(knob);
    zone.append(ring);
    return zone;
  }

  private handleDown(event: PointerEvent): void {
    const side: 'move' | 'fire' = event.clientX < window.innerWidth / 2 ? 'move' : 'fire';
    if (this.sticks[side]) return;
    event.preventDefault();

    const zone = this.zones[side];
    const ring = zone.firstElementChild as HTMLElement;
    const knob = ring.firstElementChild as HTMLElement;

    // The stick appears wherever the thumb lands, Brawl Stars style.
    ring.style.left = `${event.clientX}px`;
    ring.style.top = `${event.clientY}px`;
    zone.classList.add('touch__zone--held');

    this.sticks[side] = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      x: 0,
      y: 0,
      held: 0,
      node: ring,
      knob,
    };
    if (side === 'fire') this.state.aiming = true;
  }

  private handleMove(event: PointerEvent): void {
    const side = this.sideFor(event.pointerId);
    if (!side) return;
    event.preventDefault();

    const stick = this.sticks[side]!;
    const dx = event.clientX - stick.originX;
    const dy = event.clientY - stick.originY;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, STICK_RADIUS);
    const scale = distance > 0 ? clamped / distance : 0;

    stick.x = distance > DEAD_ZONE ? (dx * scale) / STICK_RADIUS : 0;
    stick.y = distance > DEAD_ZONE ? (dy * scale) / STICK_RADIUS : 0;
    stick.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;

    if (side === 'move') {
      this.state.moveX = stick.x;
      // Screen up is forward.
      this.state.moveY = -stick.y;
      return;
    }
    // Dragging the fire stick also steers the camera, but gently.
    this.state.lookX += stick.x * LOOK_SENSITIVITY;
    this.state.lookY += stick.y * LOOK_SENSITIVITY;
  }

  private handleUp(event: PointerEvent): void {
    const side = this.sideFor(event.pointerId);
    if (!side) return;
    const stick = this.sticks[side]!;
    stick.knob.style.transform = '';
    this.zones[side].classList.remove('touch__zone--held');
    this.sticks[side] = null;

    if (side === 'move') {
      this.state.moveX = 0;
      this.state.moveY = 0;
      return;
    }
    this.state.firing = false;
    this.state.aiming = false;
  }

  private sideFor(pointerId: number): 'move' | 'fire' | null {
    if (this.sticks.move?.pointerId === pointerId) return 'move';
    if (this.sticks.fire?.pointerId === pointerId) return 'fire';
    return null;
  }

  private reset(): void {
    for (const side of ['move', 'fire'] as const) {
      const stick = this.sticks[side];
      if (!stick) continue;
      stick.knob.style.transform = '';
      this.zones[side].classList.remove('touch__zone--held');
      this.sticks[side] = null;
    }
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.state.lookX = 0;
    this.state.lookY = 0;
    this.state.firing = false;
    this.state.aiming = false;
  }
}
