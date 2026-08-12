import type { WeaponDefinition, WeaponId } from '../WeaponDefinition';
import { AK47 } from './ak47';
import { L96 } from './l96';
import { M4A1 } from './m4a1';
import { M60 } from './m60';

/** Slot order matches the 1-4 selection keys. */
export const WEAPON_LOADOUT: readonly WeaponDefinition[] = [M4A1, AK47, M60, L96];

export const WEAPONS_BY_ID: Readonly<Record<WeaponId, WeaponDefinition>> = {
  m4a1: M4A1,
  ak47: AK47,
  m60: M60,
  l96: L96,
};

export { AK47, L96, M4A1, M60 };
