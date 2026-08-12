import type { WeaponDefinition, WeaponId } from '../WeaponDefinition';
import { AK47 } from './ak47';
import { L96 } from './l96';
import { M4A1 } from './m4a1';
import { M1911 } from './m1911';
import { M60 } from './m60';
import { M9 } from './m9';
import { MP5 } from './mp5';
import { MP7 } from './mp7';
import { UMP45 } from './ump45';

/** Every weapon the game knows about. */
export const ALL_WEAPONS: readonly WeaponDefinition[] = [
  M4A1,
  AK47,
  M60,
  L96,
  MP5,
  MP7,
  UMP45,
  M9,
  M1911,
];

export const WEAPONS_BY_ID: Readonly<Record<WeaponId, WeaponDefinition>> = {
  m4a1: M4A1,
  ak47: AK47,
  m60: M60,
  l96: L96,
  mp5: MP5,
  mp7: MP7,
  ump45: UMP45,
  m9: M9,
  m1911: M1911,
};

export { AK47, L96, M1911, M4A1, M60, M9, MP5, MP7, UMP45 };
