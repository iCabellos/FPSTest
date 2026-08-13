import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SlotMachineAnimator } from '../src/special/SlotMachineAnimator';
import {
  BULB_COUNT,
  REEL_COUNT,
  SYMBOLS_PER_REEL,
  buildSlotMachine,
} from '../src/weapons/viewmodel/models/slotmachine';
import { createWeaponMaterials } from '../src/weapons/viewmodel/parts';
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

describe('the cabinet animation', () => {
  const STEP = (Math.PI * 2) / SYMBOLS_PER_REEL;

  function cabinet(reelCount = REEL_COUNT) {
    const reels = Array.from({ length: reelCount }, () => new THREE.Object3D());
    const bulbs = Array.from({ length: 6 }, () =>
      new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 4, 3),
        new THREE.MeshPhongMaterial({ emissive: 0x000000 }),
      ),
    );
    const beacon = new THREE.Object3D();
    const animator = new SlotMachineAnimator({
      reels,
      bulbs,
      beacon: [beacon],
      jackpotLamp: [],
    });
    return { animator, reels, bulbs, beacon };
  }

  /** Which symbol a reel is currently showing at the window. */
  function showing(reel: THREE.Object3D): SlotSymbol {
    const face = Math.round(reel.rotation.x / STEP) % SYMBOLS_PER_REEL;
    const kind = ((face % 3) + 3) % 3;
    return kind === 0 ? 'x' : kind === 1 ? 'grenade' : 'nuclear';
  }

  function run(animator: SlotMachineAnimator, seconds: number): number {
    let settledAt = -1;
    const step = 1 / 60;
    for (let elapsed = 0; elapsed < seconds; elapsed += step) {
      const events = animator.update(step);
      if (events.settled && settledAt < 0) settledAt = elapsed;
    }
    return settledAt;
  }

  it('lands every reel on the symbol the rules actually rolled', () => {
    // Every combination that matters, including all five the same.
    const cases: SlotSymbol[][] = [
      ['x', 'grenade', 'nuclear', 'x', 'grenade'],
      ['nuclear', 'nuclear', 'nuclear', 'nuclear', 'nuclear'],
      ['x', 'x', 'x', 'x', 'x'],
      ['grenade', 'nuclear', 'x', 'grenade', 'nuclear'],
    ];
    for (const symbols of cases) {
      const { animator, reels } = cabinet();
      animator.spin({ symbols, jackpot: symbols.every((s) => s === 'nuclear') });
      run(animator, 8);
      reels.forEach((reel, i) => {
        expect(showing(reel), `reel ${i} of ${symbols.join()}`).toBe(symbols[i]);
      });
    }
  });

  it('stops the reels left to right, one at a time', () => {
    const { animator } = cabinet();
    animator.spin({ symbols: ['x', 'x', 'x', 'x', 'x'], jackpot: false });

    const order: number[] = [];
    const step = 1 / 60;
    for (let elapsed = 0; elapsed < 8; elapsed += step) {
      const events = animator.update(step);
      if (events.reelStopped >= 0) order.push(events.reelStopped);
    }
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it('reports settling exactly once, after the last reel', () => {
    const { animator } = cabinet();
    animator.spin({ symbols: ['x', 'grenade', 'x', 'grenade', 'x'], jackpot: false });

    let settles = 0;
    const step = 1 / 60;
    for (let elapsed = 0; elapsed < 10; elapsed += step) {
      if (animator.update(step).settled) settles++;
    }
    expect(settles).toBe(1);
    expect(animator.isSpinning).toBe(false);
  });

  it('always turns the reels forwards, never backwards to the nearest face', () => {
    const { animator, reels } = cabinet();
    animator.spin({ symbols: ['x', 'x', 'x', 'x', 'x'], jackpot: false });
    let previous = reels.map((reel) => reel.rotation.x);
    const step = 1 / 60;
    for (let elapsed = 0; elapsed < 6; elapsed += step) {
      animator.update(step);
      reels.forEach((reel, i) => {
        // A reel that ran backwards would read as a stutter on screen.
        expect(reel.rotation.x, `reel ${i}`).toBeGreaterThanOrEqual(previous[i] - 1e-6);
      });
      previous = reels.map((reel) => reel.rotation.x);
    }
  });

  it('never leaves the marquee dead, and goes wild on a jackpot', () => {
    const { animator, bulbs } = cabinet();
    // Idle still chases, so the cabinet is never simply switched off.
    run(animator, 1);
    const idle = bulbs.map((b) => (b.material as THREE.MeshPhongMaterial).emissiveIntensity);
    expect(idle.some((value) => value > 0.2)).toBe(true);

    animator.celebrateWith(true);
    expect(animator.isCelebrating).toBe(true);
    run(animator, 0.5);
    const party = bulbs.map((b) => (b.material as THREE.MeshPhongMaterial).emissiveIntensity);
    // A celebration drives them far harder than the idle chase.
    expect(Math.max(...party)).toBeGreaterThan(Math.max(...idle));
    // And the colours are no longer all the same amber.
    const hues = new Set(bulbs.map((b) => (b.material as THREE.MeshPhongMaterial).color.getHex()));
    expect(hues.size).toBeGreaterThan(1);
  });

  it('turns the beacon faster the more is happening', () => {
    const measure = (setup: (a: SlotMachineAnimator) => void): number => {
      const { animator, beacon } = cabinet();
      setup(animator);
      const before = beacon.rotation.y;
      run(animator, 0.5);
      return beacon.rotation.y - before;
    };
    const idle = measure(() => undefined);
    const jackpot = measure((a) => a.celebrateWith(true));
    expect(jackpot).toBeGreaterThan(idle * 3);
  });

  it('copes with a cabinet that exposes no parts at all', () => {
    const animator = new SlotMachineAnimator(undefined);
    animator.spin({ symbols: ['x'], jackpot: false });
    expect(() => animator.update(1 / 60)).not.toThrow();
  });
});

describe('the cabinet model', () => {
  it('gives every marquee bulb its own material to animate', () => {
    const materials = createWeaponMaterials();
    const model = buildSlotMachine(materials);
    const bulbs = (model.extras?.bulbs ?? []) as THREE.Mesh[];
    expect(bulbs.length).toBe(BULB_COUNT);

    const instances = new Set(bulbs.map((bulb) => bulb.material));
    // One shared material would make the chase a single blinking lamp.
    expect(instances.size).toBe(bulbs.length);
    // And none of them may be the shared neon the reels are painted with.
    for (const bulb of bulbs) expect(bulb.material).not.toBe(materials.neonAmber);
  });

  it('exposes the parts the animation needs, and five reels', () => {
    const model = buildSlotMachine(createWeaponMaterials());
    expect(model.extras?.reels).toHaveLength(REEL_COUNT);
    expect(model.extras?.beacon).toHaveLength(1);
    expect(model.extras?.jackpotLamp).toHaveLength(1);
  });

  it('keeps the payout lamp off the shared neon the reels use', () => {
    const materials = createWeaponMaterials();
    const model = buildSlotMachine(materials);
    const lamp = model.extras?.jackpotLamp?.[0] as THREE.Object3D;
    const lens = lamp.children[1] as THREE.Mesh;
    expect(lens.material).not.toBe(materials.neonGreen);
  });
});
