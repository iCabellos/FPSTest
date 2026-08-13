import type { WeaponId } from '../WeaponDefinition';
import { buildAK47 } from './models/ak47';
import { buildL96 } from './models/l96';
import { buildM4A1 } from './models/m4a1';
import { buildM60 } from './models/m60';
import { buildMP5 } from './models/mp5';
import { buildMP7 } from './models/mp7';
import { buildDeagle, buildM1911, buildM9 } from './models/pistols';
import { buildRevolver } from './models/revolver';
import { buildFal, buildG36, buildScarL } from './models/rifles';
import { buildRemington870, buildSpas12 } from './models/shotguns';
import { buildSlotMachine } from './models/slotmachine';
import { buildUMP45 } from './models/ump45';
import { buildUzi } from './models/uzi';
import type { WeaponMaterials, WeaponModel } from './parts';

/**
 * The registry of first person weapon models.
 *
 * Each weapon is built from the shared vocabulary in `parts.ts`, in its own
 * file, in one common local space: the bore line is Y = 0, the muzzle points
 * down −Z, and the receiver sits around the origin. Sights are built on a
 * shared sight line so aiming lines up automatically from the model's own
 * anchor rather than from hand tuned offsets.
 *
 * Swapping any of these for a GLB only requires returning the same anchors.
 */
const BUILDERS: Record<WeaponId, (materials: WeaponMaterials) => WeaponModel> = {
  m4a1: buildM4A1,
  ak47: buildAK47,
  scar: buildScarL,
  g36: buildG36,
  fal: buildFal,
  m60: buildM60,
  l96: buildL96,
  mp5: buildMP5,
  mp7: buildMP7,
  ump45: buildUMP45,
  uzi: buildUzi,
  r870: buildRemington870,
  spas12: buildSpas12,
  m9: buildM9,
  m1911: buildM1911,
  deagle: buildDeagle,
  revolver: buildRevolver,
  slotmachine: buildSlotMachine,
};

export function createWeaponModel(id: WeaponId, materials: WeaponMaterials): WeaponModel {
  return BUILDERS[id](materials);
}

export {
  createWeaponMaterials,
  disposeWeaponMaterials,
  type WeaponMaterials,
  type WeaponModel,
} from './parts';
