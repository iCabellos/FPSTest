import type * as THREE from 'three';
import {
  anchor,
  assemble,
  barrel,
  box,
  chargingHandle,
  ejectionPortCut,
  group,
  hoodedFrontPost,
  magazine,
  muzzleDevice,
  notchRearSight,
  pin,
  pistolGrip,
  rail,
  selector,
  slingLoop,
  triggerGroup,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * UMP45. A big slab sided polymer receiver, a fat straight .45 stick magazine,
 * a stock that folds up over the top, and a squared hood over the front post.
 * Everything about it is heavier than the MP5, and it should look it.
 */
export function buildUMP45(m: WeaponMaterials): WeaponModel {
  const sightY = 0.07;

  const mag = magazine(m, 'straight', {
    material: m.tan,
    position: [0, -0.028, -0.05],
    width: 0.032,
    depth: 0.078,
    height: 0.115,
  });

  const charging = chargingHandle(m, 'side', { z: -0.05, y: 0.036, x: -0.028 });

  // The stock folds over the receiver rather than telescoping into it.
  const foldingStock = group([
    box(m.tan, [0.05, 0.026, 0.19], [0, 0.004, 0.095]),
    box(m.tan, [0.054, 0.07, 0.02], [0, -0.008, 0.196]),
    box(m.rubber, [0.05, 0.066, 0.012], [0, -0.008, 0.212]),
    pin(m.metal, 0.008, 0.056, [0, 0.008, 0.006]),
  ], [0, 0.012, 0.09]);

  const parts: THREE.Object3D[] = [
    // Slab sided receiver, wide and flat.
    box(m.tan, [0.05, 0.062, 0.28], [0, 0.012, -0.02]),
    box(m.tan, [0.052, 0.018, 0.26], [0, 0.042, -0.02]),
    rail(m.darkMetal, { length: 0.22, width: 0.026, position: [0, 0.052, -0.03] }),
    ejectionPortCut(m, { z: -0.01, y: 0.016, x: 0.026, length: 0.05 }),
    pin(m.metal, 0.006, 0.056, [0, -0.014, 0.07]),
    selector(m, { z: 0.048, y: -0.012, x: 0.026, long: true }),
    triggerGroup(m, { z: 0.028, y: -0.036, radius: 0.026 }),
    pistolGrip(m, { material: m.tan, z: 0.058, angle: 0.26, length: 0.094, width: 0.036 }),
    // Magazine well, and the fat magazine hanging out of it.
    box(m.tan, [0.038, 0.05, 0.084], [0, -0.03, -0.05]),
    // Short heavy barrel under a ribbed handguard.
    barrel(m.blued, { radius: 0.0095, length: 0.18, z: -0.2, profile: 1.4 }),
    box(m.tan, [0.042, 0.042, 0.14], [0, -0.008, -0.16]),
    ...Array.from({ length: 4 }, (_unused, i) =>
      box(m.rubber, [0.044, 0.006, 0.01], [0, -0.026, -0.21 + i * 0.032]),
    ),
    muzzleDevice(m, 'plain', { radius: 0.0095, z: -0.38 }),
    foldingStock,
    slingLoop(m, [0.026, -0.02, 0.08]),
    slingLoop(m, [0, -0.03, -0.2]),
    ...notchRearSight(m, 0.02, sightY, 0.058, 0.012),
    ...hoodedFrontPost(m, -0.24, sightY, 0.03, 0.016, false),
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.395]),
    ejectionPort: anchor([0.03, 0.02, -0.01]),
    sight: anchor([0, sightY, 0.02]),
    bolt: charging,
    magazine: mag,
  });
}
