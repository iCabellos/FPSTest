import { describe, expect, it } from 'vitest';
import { RecoilSystem } from '../src/shooting/RecoilSystem';
import { SpreadModel } from '../src/shooting/SpreadModel';
import { SessionStats } from '../src/stats/SessionStats';
import { createSeededRandom } from '../src/utils/Random';
import { clamp, damp, decayToZero, lerp } from '../src/utils/math';
import { SPECIAL_AMMO } from '../src/special/SlotMachine';
import {
  AK47,
  L96,
  M4A1,
  M60,
  MP5,
  MP7,
  SLOT_MACHINE,
  UMP45,
  ALL_WEAPONS,
} from '../src/weapons/definitions';
import { Weapon } from '../src/weapons/Weapon';
import type { RecoilConfig } from '../src/weapons/WeaponDefinition';

function settle(recoil: RecoilSystem, config: RecoilConfig, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 120) recoil.update(1 / 120, config);
}

/** Total permanent climb over a burst, which is what the player must correct. */
function burstClimb(config: RecoilConfig, shots: number, seed = 7): number {
  const recoil = new RecoilSystem(createSeededRandom(seed));
  let permanent = 0;
  for (let shot = 0; shot < shots; shot++) {
    permanent += recoil.fire(config, shot, 1).permanentPitch;
    settle(recoil, config, 60 / 600);
  }
  return permanent + recoil.offsetPitch;
}

describe('recoil', () => {
  it('kicks the view up and recovers most of it', () => {
    const recoil = new RecoilSystem(createSeededRandom(1));
    recoil.fire(M4A1.recoil, 0, 1);
    settle(recoil, M4A1.recoil, 0.05);
    const peak = recoil.offsetPitch;
    expect(peak).toBeGreaterThan(0);

    settle(recoil, M4A1.recoil, 2);
    expect(Math.abs(recoil.offsetPitch)).toBeLessThan(peak * 0.05);
  });

  it('leaves a permanent share the player has to pull back down', () => {
    const recoil = new RecoilSystem(createSeededRandom(2));
    const impulse = recoil.fire(M4A1.recoil, 0, 1);
    expect(impulse.permanentPitch).toBeGreaterThan(0);
    expect(impulse.permanentPitch).toBeLessThan(M4A1.recoil.vertical);
  });

  it('climbs harder the longer the burst runs', () => {
    const recoil = new RecoilSystem(createSeededRandom(3));
    const first = recoil.fire(AK47.recoil, 0, 1).permanentPitch;
    const tenth = recoil.fire(AK47.recoil, 9, 1).permanentPitch;
    expect(tenth).toBeGreaterThan(first);
  });

  it('caps the climb multiplier', () => {
    const recoil = new RecoilSystem(createSeededRandom(4));
    const capped = recoil.fire(M60.recoil, 500, 1).permanentPitch;
    const atCap = M60.recoil.vertical * M60.recoil.maxClimb * (1 - M60.recoil.recoveryFraction);
    // Random jitter is bounded, so the value stays near the theoretical cap.
    expect(capped).toBeLessThan(atCap * 1.3);
  });

  it('is partly deterministic: the same seed replays the same pattern', () => {
    const a = new RecoilSystem(createSeededRandom(11));
    const b = new RecoilSystem(createSeededRandom(11));
    for (let shot = 0; shot < 10; shot++) {
      expect(a.fire(AK47.recoil, shot, 1).permanentYaw).toBe(
        b.fire(AK47.recoil, shot, 1).permanentYaw,
      );
    }
  });

  it('has a horizontal pattern rather than pure noise', () => {
    // With randomness removed the pattern must still swing both ways.
    const config: RecoilConfig = { ...AK47.recoil, randomness: 0 };
    const recoil = new RecoilSystem(createSeededRandom(5));
    const yaws = Array.from({ length: 12 }, (_, shot) => recoil.fire(config, shot, 1).permanentYaw);
    expect(Math.max(...yaws)).toBeGreaterThan(0);
    expect(Math.min(...yaws)).toBeLessThan(0);
  });

  it('is scaled down while aiming', () => {
    const hip = new RecoilSystem(createSeededRandom(6)).fire(M4A1.recoil, 0, 1).permanentPitch;
    const ads = new RecoilSystem(createSeededRandom(6)).fire(
      M4A1.recoil,
      0,
      M4A1.ads.recoilMultiplier,
    ).permanentPitch;
    expect(ads).toBeLessThan(hip);
  });

  it('separates the four weapons by how hard they climb', () => {
    const m4 = burstClimb(M4A1.recoil, 10);
    const ak = burstClimb(AK47.recoil, 10);
    const m60 = burstClimb(M60.recoil, 10);
    expect(ak).toBeGreaterThan(m4);
    expect(m60).toBeGreaterThan(ak);
  });

  it('resets when the weapon is swapped', () => {
    const recoil = new RecoilSystem(createSeededRandom(8));
    recoil.fire(M60.recoil, 4, 1);
    settle(recoil, M60.recoil, 0.05);
    recoil.reset();
    expect(recoil.offsetPitch).toBe(0);
    expect(recoil.offsetYaw).toBe(0);
  });
});

describe('spread', () => {
  it('blooms while firing and closes again afterwards', () => {
    const spread = new SpreadModel();
    const base = spread.compute(M4A1.spread, 0, 0);

    for (let shot = 0; shot < 8; shot++) spread.addShot(M4A1.spread);
    const bloomed = spread.compute(M4A1.spread, 0, 0);
    expect(bloomed).toBeGreaterThan(base);

    for (let i = 0; i < 240; i++) spread.update(1 / 120, M4A1.spread);
    expect(spread.compute(M4A1.spread, 0, 0)).toBeCloseTo(base, 6);
  });

  it('never blooms past the configured ceiling', () => {
    const spread = new SpreadModel();
    for (let shot = 0; shot < 500; shot++) spread.addShot(M60.spread);
    expect(spread.currentBloom).toBe(M60.spread.max);
  });

  it('is tighter when aimed and wider when moving', () => {
    const spread = new SpreadModel();
    const hip = spread.compute(M4A1.spread, 0, 0);
    expect(spread.compute(M4A1.spread, 1, 0)).toBeLessThan(hip);
    expect(spread.compute(M4A1.spread, 0, 1)).toBeGreaterThan(hip);
  });

  it('makes the sniper the most precise weapon when aimed', () => {
    const spread = new SpreadModel();
    const aimed = (config: typeof M4A1.spread) => spread.compute(config, 1, 0);
    expect(aimed(L96.spread)).toBeLessThan(aimed(M4A1.spread));
    expect(aimed(M4A1.spread)).toBeLessThan(aimed(AK47.spread));
    expect(aimed(AK47.spread)).toBeLessThan(aimed(M60.spread));
  });

  it('opens up faster on the machine gun than on the carbine', () => {
    const carbine = new SpreadModel();
    const machineGun = new SpreadModel();
    for (let shot = 0; shot < 10; shot++) {
      carbine.addShot(M4A1.spread);
      machineGun.addShot(M60.spread);
    }
    expect(machineGun.currentBloom).toBeGreaterThan(carbine.currentBloom);
  });
});

describe('session stats', () => {
  it('reports zero accuracy before the first shot', () => {
    expect(new SessionStats().accuracy).toBe(0);
  });

  it('tracks the hit ratio', () => {
    const stats = new SessionStats();
    for (let i = 0; i < 10; i++) stats.recordShot();
    for (let i = 0; i < 4; i++) stats.recordHit(50);
    expect(stats.accuracy).toBeCloseTo(0.4, 6);
    expect(stats.hitCount).toBe(4);
    expect(stats.shotsFired).toBe(10);
  });

  it('remembers the longest hit and clears on reset', () => {
    const stats = new SessionStats();
    stats.recordShot();
    stats.recordHit(25);
    stats.recordShot();
    stats.recordHit(200);
    stats.recordShot();
    stats.recordHit(100);
    expect(stats.longestHitDistance).toBe(200);

    stats.reset();
    expect(stats.accuracy).toBe(0);
    expect(stats.longestHitDistance).toBe(0);
  });
});

describe('math helpers', () => {
  it('clamps and interpolates', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });

  it('damps toward the target without overshooting', () => {
    let value = 0;
    for (let i = 0; i < 200; i++) value = damp(value, 1, 10, 1 / 60);
    expect(value).toBeGreaterThan(0.99);
    expect(value).toBeLessThanOrEqual(1);
  });

  it('damping is close to frame rate independent', () => {
    let fine = 0;
    for (let i = 0; i < 120; i++) fine = damp(fine, 1, 8, 1 / 120);
    let coarse = 0;
    for (let i = 0; i < 30; i++) coarse = damp(coarse, 1, 8, 1 / 30);
    expect(Math.abs(fine - coarse)).toBeLessThan(1e-9);
  });

  it('decays to exactly zero from either side', () => {
    expect(decayToZero(0.5, 10, 1)).toBe(0);
    expect(decayToZero(-0.5, 10, 1)).toBe(0);
    expect(decayToZero(1, 0.5, 1)).toBeCloseTo(0.5, 6);
  });
});

describe('weapon definitions', () => {
  it('exposes every weapon the game knows about', () => {
    expect(ALL_WEAPONS.map((weapon) => weapon.id)).toEqual([
      'm4a1',
      'ak47',
      'scar',
      'g36',
      'fal',
      'm60',
      'l96',
      'mp5',
      'mp7',
      'ump45',
      'uzi',
      'r870',
      'spas12',
      'm9',
      'm1911',
      'deagle',
      'revolver',
      'slotmachine',
    ]);
  });

  it('keeps every definition internally consistent', () => {
    for (const weapon of ALL_WEAPONS) {
      expect(weapon.rpm).toBeGreaterThan(0);
      expect(weapon.magazineSize).toBeGreaterThan(0);
      expect(weapon.reloadTime).toBeGreaterThan(0);
      expect(weapon.fireModes.length).toBeGreaterThan(0);
      expect(weapon.spread.base).toBeGreaterThan(0);
      expect(weapon.spread.max).toBeGreaterThan(weapon.spread.base);
      expect(weapon.ads.fov).toBeLessThan(75);
      expect(weapon.ads.sensitivityMultiplier).toBeLessThanOrEqual(1);
      // Six is the floor: a revolver cylinder, and nothing holds less.
      expect(weapon.magazineSize).toBeGreaterThanOrEqual(6);
      expect(weapon.reserveAmmo).toBeGreaterThanOrEqual(0);
      // Ballistics only bind weapons that actually launch a round. The special
      // weapon carries a projectile block to satisfy the shared shape and
      // never uses it, so holding it to muzzle velocities would assert nothing.
      if (weapon.projectile.damage > 0) {
        expect(weapon.projectile.velocity).toBeGreaterThan(250);
        expect(weapon.projectile.maxDistance).toBeGreaterThanOrEqual(200);
      }
      expect(weapon.audio.mechanical).toBeGreaterThanOrEqual(0);
      expect(weapon.audio.mechanical).toBeLessThanOrEqual(1);
      expect(weapon.adsMovementMultiplier).toBeLessThanOrEqual(weapon.movementMultiplier);
    }
  });

  it('gives the special weapon uses rather than ammunition', () => {
    expect(SLOT_MACHINE.projectile.damage).toBe(0);
    // Thirty spins and no spare: it cannot be reloaded, only bought again.
    expect(SLOT_MACHINE.magazineSize).toBe(SPECIAL_AMMO);
    expect(SLOT_MACHINE.reserveAmmo).toBe(0);
    expect(new Weapon(SLOT_MACHINE).requestReload()).toBe(false);
  });

  it('gives the bolt action a cycle time and a scope, and nothing else one', () => {
    expect(L96.boltCycleTime).toBeGreaterThan(0);
    expect(L96.ads.scope).toBeDefined();
    for (const weapon of [M4A1, AK47, M60]) {
      expect(weapon.boltCycleTime).toBeUndefined();
      expect(weapon.ads.scope).toBeUndefined();
    }
  });

  it('gives the rifles both fire modes and the machine gun only auto', () => {
    expect(M4A1.fireModes).toContain('semi');
    expect(M4A1.fireModes).toContain('auto');
    expect(AK47.fireModes).toContain('semi');
    expect(AK47.fireModes).toContain('auto');
    expect(M60.fireModes).toEqual(['auto']);
    expect(L96.fireModes).toEqual(['semi']);
  });

  it('gives every weapon its own voice', () => {
    const cracks = ALL_WEAPONS.map((weapon) => weapon.audio.crackFrequency);
    const bodies = ALL_WEAPONS.map((weapon) => weapon.audio.bodyFrequency);
    expect(new Set(cracks).size).toBe(ALL_WEAPONS.length);
    expect(new Set(bodies).size).toBe(ALL_WEAPONS.length);
    // Bigger calibres sit lower and ring out longer than the pistol rounds.
    expect(M60.audio.bodyFrequency).toBeLessThan(MP7.audio.bodyFrequency);
    expect(L96.audio.tailDecay).toBeGreaterThan(MP5.audio.tailDecay);
  });

  it('gives the submachine guns their own handling niche', () => {
    for (const smg of [MP5, MP7, UMP45]) {
      expect(smg.ads.time).toBeLessThan(M4A1.ads.time);
      expect(smg.recoil.vertical).toBeLessThan(AK47.recoil.vertical);
      expect(smg.projectile.velocity).toBeLessThan(M4A1.projectile.velocity);
    }
    // Fastest cadence, slowest bullet, heaviest thump: three different jobs.
    expect(MP7.rpm).toBeGreaterThan(MP5.rpm);
    expect(UMP45.projectile.velocity).toBeLessThan(MP5.projectile.velocity);
    expect(UMP45.recoil.vertical).toBeGreaterThan(MP5.recoil.vertical);
  });

  it('makes the heavy weapons slower to aim and to walk with', () => {
    expect(M60.ads.time).toBeGreaterThan(M4A1.ads.time);
    expect(M60.movementMultiplier).toBeLessThan(M4A1.movementMultiplier);
    expect(L96.ads.time).toBeGreaterThan(M4A1.ads.time);
  });
});
