import type * as THREE from 'three';
import {
  anchor,
  assemble,
  barrel,
  box,
  drumRearSight,
  ejectionPortCut,
  group,
  hoodedFrontPost,
  magazine,
  muzzleDevice,
  pin,
  pistolGrip,
  selector,
  slingLoop,
  stock,
  triggerGroup,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * MP5A3. Roller delayed, so the receiver is a smooth tube with the cocking
 * handle riding a tray up on the left. Slim curved magazine, retractable
 * stock, and the HK rotary drum rear over a hooded front post.
 */
export function buildMP5(m: WeaponMaterials): WeaponModel {
  const sightY = 0.068;

  const mag = magazine(m, 'curved', {
    material: m.darkMetal,
    position: [0, -0.026, -0.055],
    width: 0.024,
    depth: 0.058,
    height: 0.115,
    curve: 0.16,
  });

  // Cocking handle out on the left, in its raised tube.
  const charging = group([
    tube(m.darkMetal, 0.014, 0.014, 0.16, [-0.026, 0.03, 0.02], 10),
    box(m.metal, [0.03, 0.014, 0.03], [-0.036, 0.03, -0.05]),
  ]);

  const parts: THREE.Object3D[] = [
    // Tubular receiver with the trigger housing slung under it.
    tube(m.darkMetal, 0.026, 0.026, 0.24, [0, 0.014, 0.02], 14),
    box(m.darkMetal, [0.046, 0.03, 0.24], [0, 0.026, 0.02]),
    box(m.polymer, [0.042, 0.046, 0.12], [0, -0.024, 0.03]),
    ejectionPortCut(m, { z: -0.02, y: 0.014, x: 0.026, length: 0.05 }),
    pin(m.metal, 0.006, 0.05, [0, -0.03, 0.086]),
    selector(m, { z: 0.052, y: -0.012, x: 0.023, long: true }),
    triggerGroup(m, { z: 0.036, y: -0.038, radius: 0.024 }),
    pistolGrip(m, { z: 0.066, angle: 0.3, length: 0.09, width: 0.034 }),
    // Magazine well, slanted forward the way the real one is.
    box(m.darkMetal, [0.03, 0.06, 0.07], [0, -0.024, -0.055]),
    // Barrel inside the slim handguard, with the trident flash hider.
    barrel(m.blued, { radius: 0.0075, length: 0.22, z: -0.2, profile: 1.5 }),
    box(m.polymer, [0.036, 0.038, 0.15], [0, -0.006, -0.15], [0.03, 0, 0]),
    tube(m.polymer, 0.021, 0.021, 0.15, [0, -0.004, -0.15], 12),
    muzzleDevice(m, 'flash', { radius: 0.0075, z: -0.41 }),
    // Retractable stock on its two rails.
    stock(m, 'folding', { material: m.darkMetal, z: 0.14, length: 0.15, y: 0.004 }),
    slingLoop(m, [0.024, 0.03, -0.19]),
    slingLoop(m, [0, -0.008, 0.16]),
    ...drumRearSight(m, 0.12, sightY, 0.019),
    ...hoodedFrontPost(m, -0.24, sightY, 0.024, 0.018, true),
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.43]),
    ejectionPort: anchor([0.032, 0.018, -0.02]),
    sight: anchor([0, sightY, 0.12]),
    bolt: charging,
    magazine: mag,
  });
}
