import { describe, expect, it } from 'vitest';
import { Weapon } from '../src/weapons/Weapon';
import { AK47, L96, M4A1, M60 } from '../src/weapons/definitions';

/** Runs `seconds` of simulation in fixed steps and totals the rounds fired. */
function run(weapon: Weapon, seconds: number, step = 1 / 120): number {
  let shots = 0;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    shots += weapon.update(step).shots;
  }
  return shots;
}

function equipped(definition = M4A1): Weapon {
  const weapon = new Weapon(definition);
  run(weapon, definition.equipTime + 0.1);
  return weapon;
}

describe('cadence', () => {
  it('fires at roughly the configured rpm on full auto', () => {
    const weapon = equipped();
    weapon.setTrigger(true);
    const shots = run(weapon, 1);
    const expected = M4A1.rpm / 60;
    expect(shots).toBeGreaterThan(expected * 0.9);
    expect(shots).toBeLessThanOrEqual(expected + 1);
  });

  it('keeps average cadence independent of the step size', () => {
    const fine = equipped();
    fine.setTrigger(true);
    const coarse = equipped();
    coarse.setTrigger(true);
    expect(Math.abs(run(fine, 2, 1 / 240) - run(coarse, 2, 1 / 30))).toBeLessThanOrEqual(1);
  });

  it('never exceeds the magazine in one long burst', () => {
    const weapon = equipped();
    weapon.setTrigger(true);
    expect(run(weapon, 10)).toBe(M4A1.magazineSize);
    expect(weapon.ammo).toBe(0);
  });
});

describe('fire modes', () => {
  it('only fires once per trigger pull in semi', () => {
    const weapon = equipped();
    weapon.toggleFireMode();
    expect(weapon.fireMode).toBe('semi');

    weapon.setTrigger(true);
    expect(run(weapon, 1)).toBe(1);

    weapon.setTrigger(false);
    weapon.setTrigger(true);
    expect(run(weapon, 1)).toBe(1);
  });

  it('cycles back to the first mode', () => {
    const weapon = equipped();
    expect(weapon.fireMode).toBe('auto');
    weapon.toggleFireMode();
    weapon.toggleFireMode();
    expect(weapon.fireMode).toBe('auto');
  });

  it('refuses to switch on a single mode weapon', () => {
    const weapon = equipped(M60);
    expect(weapon.toggleFireMode()).toBe(false);
    expect(weapon.fireMode).toBe('auto');
  });
});

describe('reloading', () => {
  it('refills only after the full reload time', () => {
    const weapon = equipped();
    weapon.setTrigger(true);
    run(weapon, 0.5);
    weapon.setTrigger(false);
    const before = weapon.ammo;
    expect(before).toBeLessThan(M4A1.magazineSize);

    expect(weapon.requestReload()).toBe(true);
    run(weapon, M4A1.reloadTime - 0.1);
    expect(weapon.ammo).toBe(before);

    run(weapon, 0.2);
    expect(weapon.ammo).toBe(M4A1.magazineSize);
    expect(weapon.isReloading).toBe(false);
  });

  it('cannot fire while reloading', () => {
    const weapon = equipped();
    weapon.setTrigger(true);
    run(weapon, 0.3);
    weapon.requestReload();
    expect(run(weapon, M4A1.reloadTime - 0.1)).toBe(0);
  });

  it('does not reload a full magazine', () => {
    expect(equipped().requestReload()).toBe(false);
  });

  it('reports progress between 0 and 1', () => {
    const weapon = equipped();
    weapon.setTrigger(true);
    run(weapon, 0.3);
    weapon.requestReload();
    run(weapon, M4A1.reloadTime / 2);
    expect(weapon.reloadProgress).toBeGreaterThan(0.3);
    expect(weapon.reloadProgress).toBeLessThan(0.7);
  });
});

describe('bolt action', () => {
  it('blocks firing for the whole cycle', () => {
    const weapon = equipped(L96);
    weapon.setTrigger(true);
    expect(run(weapon, 0.1)).toBe(1);
    expect(weapon.isCyclingBolt).toBe(true);

    weapon.setTrigger(false);
    weapon.setTrigger(true);
    expect(run(weapon, L96.boltCycleTime! - 0.2)).toBe(0);

    weapon.setTrigger(false);
    run(weapon, 0.3);
    expect(weapon.isCyclingBolt).toBe(false);
    weapon.setTrigger(true);
    expect(run(weapon, 0.1)).toBe(1);
  });

  it('reports the cycle progress for the animation', () => {
    const weapon = equipped(L96);
    weapon.setTrigger(true);
    run(weapon, 0.05);
    run(weapon, L96.boltCycleTime! / 2);
    expect(weapon.boltProgress).toBeGreaterThan(0.3);
    expect(weapon.boltProgress).toBeLessThan(0.7);
  });
});

describe('equip and dry fire', () => {
  it('cannot fire until the draw finishes', () => {
    const weapon = new Weapon(M60);
    weapon.onEquip();
    weapon.setTrigger(true);
    expect(run(weapon, M60.equipTime - 0.05)).toBe(0);
    expect(run(weapon, 0.3)).toBeGreaterThan(0);
  });

  it('reports a dry fire once per pull when empty', () => {
    const weapon = equipped(L96);
    for (let i = 0; i < L96.magazineSize; i++) {
      weapon.setTrigger(false);
      weapon.setTrigger(true);
      run(weapon, L96.boltCycleTime! + 0.1);
    }
    expect(weapon.isEmpty).toBe(true);

    weapon.setTrigger(false);
    weapon.setTrigger(true);
    let dryFires = 0;
    for (let i = 0; i < 60; i++) if (weapon.update(1 / 60).dryFired) dryFires++;
    expect(dryFires).toBe(1);
  });
});

describe('burst index', () => {
  it('counts consecutive rounds and resets after a pause', () => {
    const weapon = equipped(AK47);
    weapon.setTrigger(true);
    run(weapon, 0.5);
    expect(weapon.burstIndex).toBeGreaterThan(2);

    weapon.setTrigger(false);
    run(weapon, 1);
    expect(weapon.burstIndex).toBe(0);
  });
});
