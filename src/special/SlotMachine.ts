import type { RandomSource } from '../utils/Random';

export type SlotSymbol = 'x' | 'grenade' | 'nuclear';

export const SLOT_COUNT = 5;
/** Uses carried by the special weapon. */
export const SPECIAL_AMMO = 30;
/** Spins without a jackpot before the next one is guaranteed. */
export const PITY_MAX = 20;
/** Grenades fan out at a fixed angular step, clockwise. */
export const GRENADE_STEP_DEGREES = 20;

export interface SpinOutcome {
  symbols: SlotSymbol[];
  /** Bearings in degrees for each grenade, clockwise from `baseAngle`. */
  grenadeAngles: number[];
  jackpot: boolean;
  /** Pity after this spin: reset on a jackpot, otherwise one higher. */
  pity: number;
  /** True when this jackpot was handed out by the pity counter. */
  pityGuaranteed: boolean;
}

/** Reel weights. Nuclear is rare, so five in a row is a genuine event. */
const REELS: readonly SlotSymbol[] = [
  'x',
  'x',
  'x',
  'x',
  'grenade',
  'grenade',
  'grenade',
  'nuclear',
];

/**
 * The special weapon's slot machine.
 *
 * Rules, in one place because they interact:
 * - five reels, each landing on X, GRENADE or NUCLEAR;
 * - every X does nothing;
 * - every GRENADE throws one grenade, and the grenades are spread evenly at
 *   {@link GRENADE_STEP_DEGREES} apart going clockwise;
 * - a NUCLEAR on its own does nothing;
 * - five NUCLEAR is the jackpot;
 * - a spin that is not a jackpot raises the pity counter, and once it reaches
 *   {@link PITY_MAX} the next spin is a guaranteed jackpot.
 *
 * The machine is authoritative state: one instance owns the pity counter and
 * the remaining uses, so two clients can never disagree about them.
 */
export class SlotMachine {
  private pityCounter = 0;
  private ammo = SPECIAL_AMMO;

  constructor(private readonly random: RandomSource = Math.random) {}

  get pity(): number {
    return this.pityCounter;
  }

  get remainingAmmo(): number {
    return this.ammo;
  }

  /** True when the next spin cannot lose. */
  get isJackpotGuaranteed(): boolean {
    return this.pityCounter >= PITY_MAX;
  }

  get canSpin(): boolean {
    return this.ammo > 0;
  }

  /**
   * Consumes one use and resolves a spin.
   *
   * @param baseAngle bearing the first grenade flies toward, in degrees.
   * @returns the outcome, or null when the weapon is empty.
   */
  spin(baseAngle = 0): SpinOutcome | null {
    if (this.ammo <= 0) return null;
    this.ammo--;

    const guaranteed = this.isJackpotGuaranteed;
    const symbols = guaranteed ? this.allNuclear() : this.rollSymbols();
    const jackpot = isJackpot(symbols);

    this.pityCounter = jackpot ? 0 : this.pityCounter + 1;

    return {
      symbols,
      grenadeAngles: grenadeAngles(symbols, baseAngle),
      jackpot,
      pity: this.pityCounter,
      pityGuaranteed: guaranteed,
    };
  }

  /** Restores the weapon, e.g. when it is picked up again. */
  reset(): void {
    this.pityCounter = 0;
    this.ammo = SPECIAL_AMMO;
  }

  private allNuclear(): SlotSymbol[] {
    return Array.from({ length: SLOT_COUNT }, () => 'nuclear' as const);
  }

  private rollSymbols(): SlotSymbol[] {
    return Array.from({ length: SLOT_COUNT }, () => {
      const index = Math.min(REELS.length - 1, Math.floor(this.random() * REELS.length));
      return REELS[index];
    });
  }
}

export function isJackpot(symbols: readonly SlotSymbol[]): boolean {
  return symbols.length === SLOT_COUNT && symbols.every((symbol) => symbol === 'nuclear');
}

export function countGrenades(symbols: readonly SlotSymbol[]): number {
  return symbols.filter((symbol) => symbol === 'grenade').length;
}

/**
 * One bearing per GRENADE symbol, each a fixed step clockwise from the last.
 * Clockwise when viewed from above means increasing compass bearing, so the
 * angles simply advance by the step and wrap at 360.
 */
export function grenadeAngles(symbols: readonly SlotSymbol[], baseAngle = 0): number[] {
  const total = countGrenades(symbols);
  return Array.from({ length: total }, (_, index) =>
    normaliseDegrees(baseAngle + index * GRENADE_STEP_DEGREES),
  );
}

export function normaliseDegrees(angle: number): number {
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
