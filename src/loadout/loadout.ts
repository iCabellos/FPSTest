import type { WeaponDefinition, WeaponId } from '../weapons/WeaponDefinition';
import { WEAPONS_BY_ID } from '../weapons/definitions';

/** A chosen pair carried into a match: what you hold, and what you swap to. */
export interface Loadout {
  primary: WeaponId;
  secondary: WeaponId;
}

export interface WeaponChoice {
  id: WeaponId;
  name: string;
  category: string;
  /** One line of why you would pick this one. */
  summary: string;
}

function describe(id: WeaponId, category: string, summary: string): WeaponChoice {
  return { id, name: WEAPONS_BY_ID[id].name, category, summary };
}

/** Everything the range lets you take as a primary. */
export const RANGE_PRIMARIES: readonly WeaponChoice[] = [
  describe('m4a1', 'Assault rifle', 'Fast, controllable, mild climb.'),
  describe('ak47', 'Assault rifle', 'Heavy hitting, walks off target in long bursts.'),
  describe('scar', 'Assault rifle', 'Firmer push per shot, but the climb is short and straight.'),
  describe('g36', 'Assault rifle', 'The most forgiving here. Fast, flat, and light on damage.'),
  describe('fal', 'Battle rifle', '7.62 that hits twice as hard. Twenty rounds, and it fights you.'),
  describe('m60', 'Machine gun', 'Belt fed. Slow to handle, sprays under sustained fire.'),
  describe('l96', 'Sniper', 'Bolt action with a 6x scope. One precise shot at a time.'),
  describe('mp5', 'Submachine gun', 'Flat and controllable, slow arcing 9 mm.'),
  describe('mp7', 'Submachine gun', 'Fastest cadence, lightest kick, wanders sideways.'),
  describe('ump45', 'Submachine gun', 'Slow thumping .45 that drops hard past 100 m.'),
  describe('uzi', 'Submachine gun', 'A hose for corridors. Loses interest past fifty metres.'),
  describe('r870', 'Shotgun', 'Eight shells of buck, pumped between every shot.'),
  describe('spas12', 'Shotgun', 'Semi auto buckshot. Faster, wider, and holds fewer.'),
];

/** Sidearms the range offers as a secondary. */
export const SIDEARMS: readonly WeaponChoice[] = [
  describe('m9', 'Sidearm', '17 rounds. Lighter hits, but you can keep firing.'),
  describe('m1911', 'Sidearm', '7 rounds of .45. Hits harder, empties fast.'),
  describe('deagle', 'Hand cannon', '.50 AE. Rifle damage out of a pistol that bucks for it.'),
  describe('revolver', 'Hand cannon', 'Six of .357, refilled a cylinder at a time.'),
];

/**
 * What zombies lets you open with. Deliberately only the two plain pistols:
 * the rest of the arsenal is earned inside the mansion, so starting with a
 * hand cannon would undercut every wall buy in the building.
 */
export const ZOMBIES_STARTERS: readonly WeaponChoice[] = [
  describe('m9', 'Sidearm', '17 rounds. Lighter hits, but you can keep firing.'),
  describe('m1911', 'Sidearm', '7 rounds of .45. Hits harder, empties fast.'),
];

export const DEFAULT_RANGE_LOADOUT: Loadout = { primary: 'm4a1', secondary: 'm9' };

/**
 * Zombies starts you on a sidearm only: the rest of the arsenal is earned
 * inside the mansion, so the only choice here is which pistol you open with.
 */
export const DEFAULT_ZOMBIES_LOADOUT: Loadout = { primary: 'm9', secondary: 'm9' };

/** Resolves a loadout into the weapon list a WeaponSystem should carry. */
export function resolveLoadout(loadout: Loadout): WeaponDefinition[] {
  if (loadout.primary === loadout.secondary) return [WEAPONS_BY_ID[loadout.primary]];
  return [WEAPONS_BY_ID[loadout.primary], WEAPONS_BY_ID[loadout.secondary]];
}
