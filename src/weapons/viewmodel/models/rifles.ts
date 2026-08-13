import type * as THREE from 'three';
import {
  anchor,
  assemble,
  barrel,
  box,
  chargingHandle,
  ejectionPortCut,
  gasSystem,
  group,
  handguard,
  hoodedFrontPost,
  magazine,
  muzzleDevice,
  notchRearSight,
  pin,
  pistolGrip,
  post,
  rail,
  ring,
  selector,
  slingLoop,
  stock,
  triggerGroup,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * SCAR-L. Monolithic upper with a rail running its whole length, a low profile
 * gas block, and a side folding stock with an adjustable cheek riser. Reads
 * modern and squared off next to the M4.
 */
export function buildScarL(m: WeaponMaterials): WeaponModel {
  const sightY = 0.086;

  const mag = magazine(m, 'curved', {
    material: m.tan,
    position: [0, -0.03, -0.02],
    width: 0.03,
    depth: 0.062,
    height: 0.12,
    curve: 0.12,
  });

  const charging = chargingHandle(m, 'side', { z: -0.06, y: 0.05, x: -0.03 });

  const flipSights = group([
    box(m.darkMetal, [0.026, 0.02, 0.016], [0, 0.072, 0.07]),
    ring(m.darkMetal, 0.0105, 0.0032, [0, sightY, 0.07], 12),
    box(m.darkMetal, [0.022, 0.02, 0.014], [0, 0.072, -0.3]),
    box(m.metal, [0.004, 0.026, 0.005], [0, sightY - 0.01, -0.3]),
    box(m.darkMetal, [0.004, 0.024, 0.012], [-0.01, sightY - 0.01, -0.3]),
    box(m.darkMetal, [0.004, 0.024, 0.012], [0.01, sightY - 0.01, -0.3]),
  ]);

  const parts: THREE.Object3D[] = [
    // One piece aluminium upper, squared, with rails on all four faces.
    box(m.tan, [0.048, 0.05, 0.42], [0, 0.04, -0.14]),
    rail(m.darkMetal, { length: 0.4, width: 0.028, position: [0, 0.066, -0.14] }),
    rail(m.darkMetal, { length: 0.16, width: 0.024, position: [0, 0.014, -0.28] }),
    ejectionPortCut(m, { z: 0.02, y: 0.036, x: 0.025, length: 0.06 }),
    // Polymer lower with the mag well and the trigger pack.
    box(m.tan, [0.046, 0.056, 0.2], [0, -0.006, 0.03]),
    box(m.tan, [0.042, 0.05, 0.076], [0, -0.026, -0.02]),
    pin(m.metal, 0.006, 0.052, [0, 0.012, 0.116]),
    selector(m, { z: 0.07, y: 0.006, x: 0.024 }),
    triggerGroup(m, { z: 0.042, y: -0.034, radius: 0.026 }),
    pistolGrip(m, { material: m.tan, z: 0.08, angle: 0.28, length: 0.098, width: 0.038 }),
    // Barrel, low profile gas block and a birdcage.
    barrel(m.blued, { radius: 0.0095, length: 0.34, z: -0.32, profile: 1.6 }),
    gasSystem(m, { z: -0.4, radius: 0.013, tubeLength: 0.12, y: 0.008 }),
    muzzleDevice(m, 'flash', { radius: 0.0095, z: -0.63 }),
    // Side folding stock with a riser.
    stock(m, 'folding', { material: m.tan, z: 0.13, length: 0.19, y: 0.012 }),
    box(m.tan, [0.03, 0.02, 0.1], [0, 0.05, 0.2]),
    slingLoop(m, [0.026, 0.014, 0.12]),
    slingLoop(m, [0, -0.014, -0.3]),
    flipSights,
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.66]),
    ejectionPort: anchor([0.03, 0.04, 0.02]),
    sight: anchor([0, sightY, 0.07]),
    bolt: charging,
    magazine: mag,
  });
}

/**
 * G36. All polymer, with the carry handle and its integral optic sitting well
 * above the receiver, a skeletal side folding stock, and the open sided
 * handguard the rifle is known for.
 */
export function buildG36(m: WeaponMaterials): WeaponModel {
  const sightY = 0.096;

  const mag = magazine(m, 'curved', {
    material: m.rubber,
    position: [0, -0.028, -0.02],
    width: 0.032,
    depth: 0.064,
    height: 0.125,
    curve: 0.16,
  });

  const charging = chargingHandle(m, 'top', { z: -0.08, y: 0.058 });

  // Carry handle with the optic built into it: the G36's whole profile.
  const carryOptic = group([
    box(m.polymer, [0.03, 0.03, 0.2], [0, 0.078, 0]),
    box(m.polymer, [0.034, 0.02, 0.05], [0, 0.056, -0.08]),
    box(m.polymer, [0.034, 0.02, 0.05], [0, 0.056, 0.08]),
    tube(m.darkMetal, 0.017, 0.017, 0.13, [0, sightY, 0.005], 12),
    tube(m.glass, 0.015, 0.015, 0.005, [0, sightY, -0.062]),
    tube(m.glass, 0.014, 0.014, 0.005, [0, sightY, 0.072]),
  ], [0, 0, -0.02]);

  const parts: THREE.Object3D[] = [
    // Polymer receiver, rounded rather than slab sided.
    box(m.polymer, [0.05, 0.058, 0.3], [0, 0.026, -0.02]),
    tube(m.polymer, 0.028, 0.028, 0.28, [0, 0.03, -0.02], 12),
    ejectionPortCut(m, { z: 0.026, y: 0.026, x: 0.026, length: 0.055 }),
    box(m.polymer, [0.044, 0.05, 0.09], [0, -0.02, 0.02]),
    box(m.polymer, [0.04, 0.056, 0.074], [0, -0.03, -0.02]),
    pin(m.metal, 0.006, 0.054, [0, 0.006, 0.09]),
    selector(m, { z: 0.056, y: -0.004, x: 0.026 }),
    triggerGroup(m, { z: 0.032, y: -0.036, radius: 0.028 }),
    pistolGrip(m, { z: 0.066, angle: 0.3, length: 0.096, width: 0.038 }),
    // Barrel inside the open handguard, with its vents.
    barrel(m.blued, { radius: 0.009, length: 0.3, z: -0.27, profile: 1.5 }),
    handguard(m, {
      material: m.polymer,
      length: 0.21,
      radius: 0.03,
      z: -0.25,
      style: 'round',
      vents: 4,
    }),
    box(m.polymer, [0.05, 0.014, 0.2], [0, -0.03, -0.25]),
    muzzleDevice(m, 'flash', { radius: 0.009, z: -0.57 }),
    // Skeleton side folder.
    stock(m, 'skeleton', { material: m.polymer, z: 0.13, length: 0.18, y: 0.014 }),
    slingLoop(m, [0.028, 0.02, -0.2]),
    slingLoop(m, [0, -0.02, 0.14]),
    carryOptic,
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.6]),
    ejectionPort: anchor([0.032, 0.03, 0.026]),
    sight: anchor([0, sightY, 0.06]),
    bolt: charging,
    magazine: mag,
  });
}

/**
 * FN FAL. Wood and steel battle rifle: long tilting bolt receiver, a big
 * twenty round 7.62 magazine, a wooden handguard and a straight wooden stock,
 * with a folding charging handle on the left.
 */
export function buildFal(m: WeaponMaterials): WeaponModel {
  const sightY = 0.078;

  const mag = magazine(m, 'curved', {
    material: m.darkMetal,
    position: [0, -0.028, -0.03],
    width: 0.034,
    depth: 0.076,
    height: 0.145,
    curve: 0.12,
  });

  const charging = chargingHandle(m, 'side', { z: -0.05, y: 0.034, x: -0.032 });

  const parts: THREE.Object3D[] = [
    // Long milled receiver with the dust cover on top.
    box(m.darkMetal, [0.046, 0.058, 0.32], [0, 0.024, 0.01]),
    box(m.darkMetal, [0.048, 0.016, 0.28], [0, 0.056, 0.01]),
    ejectionPortCut(m, { z: 0.03, y: 0.026, x: 0.025, length: 0.07 }),
    pin(m.metal, 0.007, 0.052, [0, 0.008, 0.15]),
    selector(m, { z: 0.07, y: -0.004, x: 0.024, long: true }),
    triggerGroup(m, { z: 0.05, y: -0.036, radius: 0.026 }),
    pistolGrip(m, { material: m.wood, z: 0.084, angle: 0.3, length: 0.1, width: 0.038 }),
    // Barrel with the gas plug and a long flash hider.
    barrel(m.blued, { radius: 0.011, length: 0.38, z: -0.3, profile: 1.6 }),
    gasSystem(m, { z: -0.32, radius: 0.017, tubeLength: 0.16, y: 0.012 }),
    muzzleDevice(m, 'flash', { radius: 0.011, z: -0.64 }),
    // Wooden furniture.
    box(m.wood, [0.044, 0.046, 0.2], [0, -0.014, -0.24], [0.02, 0, 0]),
    box(m.wood, [0.038, 0.028, 0.18], [0, 0.028, -0.24]),
    stock(m, 'fixed', { material: m.wood, z: 0.18, length: 0.22, y: 0.006 }),
    // Carry handle folded down on the left, a FAL signature.
    box(m.darkMetal, [0.05, 0.012, 0.02], [-0.02, 0.05, -0.1], [0, 0, 0.5]),
    post(m.metal, 0.006, 0.05, [-0.04, 0.038, -0.1], 8).rotateX(Math.PI / 2),
    slingLoop(m, [0, -0.038, -0.28]),
    slingLoop(m, [0, -0.03, 0.2]),
    ...notchRearSight(m, 0.12, sightY, 0.058, 0.011),
    ...hoodedFrontPost(m, -0.46, sightY, 0.028, 0.016, false),
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.67]),
    ejectionPort: anchor([0.032, 0.03, 0.03]),
    sight: anchor([0, sightY, 0.12]),
    bolt: charging,
    magazine: mag,
  });
}
