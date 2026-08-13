import type { WeaponDefinition, WeaponId } from '../WeaponDefinition';
import { AK47 } from './ak47';
import { DEAGLE } from './deagle';
import { FAL } from './fal';
import { G36 } from './g36';
import { L96 } from './l96';
import { M4A1 } from './m4a1';
import { M1911 } from './m1911';
import { M60 } from './m60';
import { M9 } from './m9';
import { MP5 } from './mp5';
import { MP7 } from './mp7';
import { R870 } from './r870';
import { REVOLVER } from './revolver';
import { SCAR } from './scar';
import { SLOT_MACHINE } from './slotmachine';
import { SPAS12 } from './spas12';
import { UMP45 } from './ump45';
import { UZI } from './uzi';

/** Every weapon the game knows about, grouped by class. */
export const ALL_WEAPONS: readonly WeaponDefinition[] = [
  M4A1,
  AK47,
  SCAR,
  G36,
  FAL,
  M60,
  L96,
  MP5,
  MP7,
  UMP45,
  UZI,
  R870,
  SPAS12,
  M9,
  M1911,
  DEAGLE,
  REVOLVER,
  SLOT_MACHINE,
];

export const WEAPONS_BY_ID: Readonly<Record<WeaponId, WeaponDefinition>> = {
  m4a1: M4A1,
  ak47: AK47,
  scar: SCAR,
  g36: G36,
  fal: FAL,
  m60: M60,
  l96: L96,
  mp5: MP5,
  mp7: MP7,
  ump45: UMP45,
  uzi: UZI,
  r870: R870,
  spas12: SPAS12,
  m9: M9,
  m1911: M1911,
  deagle: DEAGLE,
  revolver: REVOLVER,
  slotmachine: SLOT_MACHINE,
};

export {
  AK47,
  DEAGLE,
  FAL,
  G36,
  L96,
  M1911,
  M4A1,
  M60,
  M9,
  MP5,
  MP7,
  R870,
  REVOLVER,
  SCAR,
  SLOT_MACHINE,
  SPAS12,
  UMP45,
  UZI,
};
