import { describe, expect, it } from 'vitest';
import {
  countGrenades,
  grenadeAngles,
  GRENADE_STEP_DEGREES,
  isJackpot,
  PITY_MAX,
  SLOT_COUNT,
  SlotMachine,
  SPECIAL_AMMO,
  type SlotSymbol,
} from '../src/special/SlotMachine';
import { createSeededRandom } from '../src/utils/Random';

/** Machine whose reels always land on the same symbol. */
function fixed(symbol: SlotSymbol): SlotMachine {
  const index = symbol === 'x' ? 0 : symbol === 'grenade' ? 0.6 : 0.99;
  return new SlotMachine(() => index);
}

describe('slot symbols', () => {
  it('only ever produces the three legal symbols', () => {
    const machine = new SlotMachine(createSeededRandom(9));
    const legal = new Set<SlotSymbol>(['x', 'grenade', 'nuclear']);
    for (let i = 0; i < SPECIAL_AMMO; i++) {
      const outcome = machine.spin();
      expect(outcome).not.toBeNull();
      expect(outcome!.symbols).toHaveLength(SLOT_COUNT);
      for (const symbol of outcome!.symbols) expect(legal.has(symbol)).toBe(true);
    }
  });

  it('always shows exactly five slots', () => {
    expect(fixed('x').spin()!.symbols).toHaveLength(5);
  });
});

describe('results', () => {
  it('does nothing at all when every slot is an X', () => {
    const outcome = fixed('x').spin()!;
    expect(outcome.symbols.every((symbol) => symbol === 'x')).toBe(true);
    expect(outcome.grenadeAngles).toEqual([]);
    expect(outcome.jackpot).toBe(false);
  });

  it('throws one grenade per grenade symbol', () => {
    const outcome = fixed('grenade').spin()!;
    expect(countGrenades(outcome.symbols)).toBe(5);
    expect(outcome.grenadeAngles).toHaveLength(5);
  });

  it('spreads the grenades twenty degrees apart, clockwise', () => {
    const angles = grenadeAngles(['grenade', 'grenade', 'grenade', 'x', 'x'], 0);
    expect(angles).toEqual([0, 20, 40]);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBe(GRENADE_STEP_DEGREES);
    }
  });

  it('fans the grenades out from whatever bearing it is given, wrapping at 360', () => {
    expect(grenadeAngles(['grenade', 'grenade'], 350)).toEqual([350, 10]);
  });

  it('places a full five grenade spread without overlapping', () => {
    const angles = grenadeAngles(Array.from({ length: 5 }, () => 'grenade' as const), 90);
    expect(angles).toEqual([90, 110, 130, 150, 170]);
    expect(new Set(angles).size).toBe(5);
  });

  it('treats a lone nuclear as nothing', () => {
    const symbols: SlotSymbol[] = ['nuclear', 'x', 'x', 'x', 'x'];
    expect(isJackpot(symbols)).toBe(false);
    expect(grenadeAngles(symbols)).toEqual([]);
  });

  it('needs all five nuclear for a jackpot', () => {
    expect(isJackpot(['nuclear', 'nuclear', 'nuclear', 'nuclear', 'x'])).toBe(false);
    expect(isJackpot(['nuclear', 'nuclear', 'nuclear', 'nuclear', 'nuclear'])).toBe(true);
  });

  it('reports a jackpot when the reels come up all nuclear', () => {
    const outcome = fixed('nuclear').spin()!;
    expect(outcome.jackpot).toBe(true);
  });
});

describe('pity', () => {
  it('starts empty', () => {
    expect(new SlotMachine().pity).toBe(0);
  });

  it('rises on every spin that is not a jackpot', () => {
    const machine = fixed('x');
    machine.spin();
    machine.spin();
    expect(machine.pity).toBe(2);
  });

  it('guarantees a jackpot once it reaches the maximum', () => {
    const machine = fixed('x');
    for (let i = 0; i < PITY_MAX; i++) machine.spin();
    expect(machine.pity).toBe(PITY_MAX);
    expect(machine.isJackpotGuaranteed).toBe(true);

    const outcome = machine.spin()!;
    expect(outcome.jackpot).toBe(true);
    expect(outcome.pityGuaranteed).toBe(true);
    expect(outcome.symbols.every((symbol) => symbol === 'nuclear')).toBe(true);
  });

  it('resets after any jackpot', () => {
    const machine = fixed('x');
    for (let i = 0; i < PITY_MAX; i++) machine.spin();
    machine.spin();
    expect(machine.pity).toBe(0);
    expect(machine.isJackpotGuaranteed).toBe(false);
  });

  it('resets when a jackpot arrives on its own, before pity is full', () => {
    const machine = fixed('nuclear');
    const outcome = machine.spin()!;
    expect(outcome.jackpot).toBe(true);
    expect(outcome.pityGuaranteed).toBe(false);
    expect(machine.pity).toBe(0);
  });

  it('never contradicts itself: a spin is either a jackpot or raises pity', () => {
    const machine = new SlotMachine(createSeededRandom(21));
    let previous = 0;
    for (let i = 0; i < SPECIAL_AMMO; i++) {
      const outcome = machine.spin()!;
      if (outcome.jackpot) expect(outcome.pity).toBe(0);
      else expect(outcome.pity).toBe(previous + 1);
      previous = outcome.pity;
    }
  });
});

describe('ammunition', () => {
  it('carries thirty uses', () => {
    expect(new SlotMachine().remainingAmmo).toBe(SPECIAL_AMMO);
    expect(SPECIAL_AMMO).toBe(30);
  });

  it('spends one use per spin and then stops', () => {
    const machine = fixed('x');
    for (let i = 0; i < SPECIAL_AMMO; i++) expect(machine.spin()).not.toBeNull();
    expect(machine.remainingAmmo).toBe(0);
    expect(machine.canSpin).toBe(false);
    expect(machine.spin()).toBeNull();
  });

  it('does not move the pity counter on a refused spin', () => {
    const machine = fixed('x');
    for (let i = 0; i < SPECIAL_AMMO; i++) machine.spin();
    const pity = machine.pity;
    machine.spin();
    expect(machine.pity).toBe(pity);
  });

  it('restores ammo and pity when reset', () => {
    const machine = fixed('x');
    machine.spin();
    machine.reset();
    expect(machine.remainingAmmo).toBe(SPECIAL_AMMO);
    expect(machine.pity).toBe(0);
  });
});
