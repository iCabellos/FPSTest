import * as THREE from 'three';
import {
  REEL_COUNT,
  SYMBOLS_PER_REEL,
} from '../weapons/viewmodel/models/slotmachine';
import type { SlotSymbol } from './SlotMachine';

/** Seconds the first reel spins before it bites. */
const FIRST_STOP = 0.55;
/** Extra time each reel to the right runs on for. */
const STOP_STAGGER = 0.24;
/** Radians per second while a reel is running flat out. */
const SPIN_SPEED = 34;
/** How fast a stopped reel settles onto its detent. */
const SETTLE = 16;
/** Seconds the whole cabinet celebrates a jackpot. */
const JACKPOT_TIME = 5;
const WIN_TIME = 1.6;
/** Bulbs chase this many times a second. */
const CHASE_SPEED = 5.5;

/** One reel's own little state machine. */
interface Reel {
  readonly object: THREE.Object3D;
  /** Radians. Free running while spinning, eased to `target` once stopped. */
  angle: number;
  spinning: boolean;
  stopAt: number;
  target: number;
  /** What this reel has to be showing when it stops. */
  symbol: SlotSymbol;
}

export interface SpinRequest {
  symbols: readonly SlotSymbol[];
  jackpot: boolean;
}

/** What the animator wants the rest of the game to do this frame. */
export interface AnimatorEvents {
  /** A reel just bit. Rises in pitch as the reels land left to right. */
  reelStopped: number;
  /** True on the single frame the last reel lands. */
  settled: boolean;
}

const events: AnimatorEvents = { reelStopped: -1, settled: false };
const tmpColour = new THREE.Color();

/**
 * Drives the slot machine's reels, marquee and lamps.
 *
 * The reels are not decoration: a spin runs all five, then stops them left to
 * right on a stagger, each one landing on the symbol the rules actually
 * rolled. Everything else on the cabinet — the bulb chase, the beacon, the
 * jackpot lamp, the colour cycling — reacts to what the reels are doing, so
 * the machine is at its loudest exactly when something has happened.
 *
 * It owns no scene objects. It is handed the parts the model exposes through
 * `extras` and animates them in place, so a cached view model can be picked up
 * and put down without rebuilding anything.
 */
export class SlotMachineAnimator {
  private readonly reels: Reel[] = [];
  private readonly bulbs: THREE.Object3D[];
  private readonly beacon: THREE.Object3D | null;
  private readonly jackpotLamp: THREE.Object3D | null;

  private elapsed = 0;
  private spinTime = 0;
  private spinning = false;
  private celebrate = 0;
  private celebrateJackpot = false;

  constructor(extras: Readonly<Record<string, readonly THREE.Object3D[]>> | undefined) {
    for (const object of extras?.reels ?? []) {
      this.reels.push({
        object,
        angle: 0,
        spinning: false,
        stopAt: 0,
        target: 0,
        symbol: 'x',
      });
    }
    this.bulbs = [...(extras?.bulbs ?? [])];
    this.beacon = extras?.beacon?.[0] ?? null;
    this.jackpotLamp = extras?.jackpotLamp?.[0] ?? null;
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  /** True while the cabinet is still making a fuss about the last result. */
  get isCelebrating(): boolean {
    return this.celebrate > 0;
  }

  /**
   * Throws the lever. Every reel starts running and is given the angle it has
   * to land on, so what stops in the window is what the rules rolled.
   */
  spin(request: SpinRequest): void {
    this.spinning = true;
    this.spinTime = 0;
    this.celebrate = 0;
    this.celebrateJackpot = false;

    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      reel.spinning = true;
      reel.stopAt = FIRST_STOP + i * STOP_STAGGER;
      reel.symbol = request.symbols[i] ?? 'x';
    }
  }

  /**
   * @returns what happened this frame, so the mode can put a sound on it.
   *   The same object every frame; nothing here allocates.
   */
  update(dt: number): AnimatorEvents {
    this.elapsed += dt;
    events.reelStopped = -1;
    events.settled = false;

    if (this.spinning) {
      this.spinTime += dt;
      let running = false;

      for (let i = 0; i < this.reels.length; i++) {
        const reel = this.reels[i];
        if (reel.spinning) {
          if (this.spinTime < reel.stopAt) {
            // Slow down over the last stretch, so it eases into the detent.
            const remaining = reel.stopAt - this.spinTime;
            const speed = SPIN_SPEED * Math.min(1, remaining / 0.35 + 0.25);
            reel.angle += speed * dt;
            running = true;
          } else {
            reel.spinning = false;
            // The detent is chosen here rather than when the lever was pulled,
            // against the angle the reel has actually reached. Picking it up
            // front lets the free spin overshoot it, and the reel then settles
            // by running backwards — a visible jerk on a part that should only
            // ever turn one way.
            reel.target = this.detentFor(reel.symbol, reel.angle);
            events.reelStopped = i;
          }
        }

        if (!reel.spinning) {
          // Always forwards: the target is ahead by construction.
          const delta = reel.target - reel.angle;
          reel.angle += delta * Math.min(1, dt * SETTLE);
          if (delta > 0.004) running = true;
        }

        reel.object.rotation.x = reel.angle;
      }

      if (!running) {
        this.spinning = false;
        events.settled = true;
      }
    }

    if (this.celebrate > 0) this.celebrate = Math.max(0, this.celebrate - dt);
    this.updateLamps(dt);
    return events;
  }

  /** Starts the light show. A jackpot runs far longer and far harder. */
  celebrateWith(jackpot: boolean): void {
    this.celebrateJackpot = jackpot;
    this.celebrate = jackpot ? JACKPOT_TIME : WIN_TIME;
  }

  /**
   * Marquee, beacon and jackpot lamp.
   *
   * Idle is a slow amber chase so the thing is never actually still. Spinning
   * doubles the rate. A win cycles the whole marquee through the spectrum and
   * spins the beacon hard, which is the point: it should be impossible to miss
   * that something happened.
   */
  private updateLamps(dt: number): void {
    const celebrating = this.celebrate > 0;
    const rate = celebrating ? 3.2 : this.spinning ? 2 : 1;
    const chase = this.elapsed * CHASE_SPEED * rate;

    for (let i = 0; i < this.bulbs.length; i++) {
      const bulb = this.bulbs[i] as THREE.Mesh;
      const material = bulb.material as THREE.MeshPhongMaterial;
      if (!material?.emissive) continue;

      const phase = chase - (i / this.bulbs.length) * Math.PI * 2 * 2;
      const lit = 0.35 + 0.65 * Math.max(0, Math.sin(phase));

      if (celebrating) {
        // Rainbow: hue runs round the marquee and round again over time.
        const hue = (i / this.bulbs.length + this.elapsed * 0.8) % 1;
        tmpColour.setHSL(hue, 1, 0.55);
      } else {
        tmpColour.setHSL(0.11, 1, 0.5);
      }
      material.color.copy(tmpColour);
      material.emissive.copy(tmpColour);
      material.emissiveIntensity = lit * (celebrating ? 2.4 : 1.1);
      // Bulbs swell as they light, so the chase reads even in bright rooms.
      bulb.scale.setScalar(0.8 + lit * (celebrating ? 0.9 : 0.35));
    }

    if (this.beacon) {
      const speed = celebrating ? (this.celebrateJackpot ? 22 : 12) : this.spinning ? 8 : 2.5;
      this.beacon.rotation.y += speed * dt;
      this.beacon.scale.setScalar(celebrating ? 1.25 : 1);
    }

    if (this.jackpotLamp) {
      const lamp = this.jackpotLamp.children[1] as THREE.Mesh | undefined;
      const material = lamp?.material as THREE.MeshPhongMaterial | undefined;
      if (material?.emissive) {
        // Hard on/off strobe on a jackpot, a steady glow otherwise.
        const strobe = this.celebrateJackpot && celebrating
          ? Math.sin(this.elapsed * 34) > 0
            ? 1
            : 0
          : celebrating
            ? 1
            : 0.25;
        material.emissiveIntensity = 0.3 + strobe * 3;
      }
    }
  }

  /**
   * The next rotation ahead of `from` that puts a given symbol in the window.
   *
   * The reel strip repeats X, grenade, nuclear, so two of the six faces carry
   * the wanted symbol; whichever comes up first going forwards is the one the
   * reel settles onto.
   */
  private detentFor(symbol: SlotSymbol, from: number): number {
    const kind = symbol === 'x' ? 0 : symbol === 'grenade' ? 1 : 2;
    const step = (Math.PI * 2) / SYMBOLS_PER_REEL;
    const turn = Math.PI * 2;

    let bestAhead = Infinity;
    for (let face = 0; face < SYMBOLS_PER_REEL; face++) {
      if (face % 3 !== kind) continue;
      // How far forward from here to that face, wrapped into one turn.
      let ahead = face * step - (from % turn);
      while (ahead < 0) ahead += turn;
      if (ahead < bestAhead) bestAhead = ahead;
    }
    return from + bestAhead;
  }
}

export { REEL_COUNT };
