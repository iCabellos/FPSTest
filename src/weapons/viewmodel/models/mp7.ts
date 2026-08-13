import type * as THREE from 'three';
import {
  anchor,
  assemble,
  barrel,
  box,
  chargingHandle,
  ejectionPortCut,
  group,
  magazine,
  muzzleDevice,
  pistolGrip,
  post,
  rail,
  ring,
  selector,
  slingLoop,
  stock,
  triggerGroup,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * MP7A1. Tiny polymer machine pistol: magazine in the grip, folding vertical
 * foregrip under the stubby barrel, telescoping wire stock, and flip up ghost
 * ring sights that fold flat onto the top rail.
 */
export function buildMP7(m: WeaponMaterials): WeaponModel {
  const sightY = 0.062;

  // Magazine lives in the grip, so it drops out of the bottom of it.
  const mag = magazine(m, 'stick', {
    material: m.rubber,
    position: [0, -0.116, 0.062],
    width: 0.026,
    depth: 0.042,
    height: 0.05,
  });

  const foregrip = group([
    box(m.polymer, [0.024, 0.062, 0.028], [0, -0.034, 0], [0.06, 0, 0]),
    box(m.polymer, [0.028, 0.012, 0.032], [0, -0.066, 0.004]),
  ], [0, -0.014, -0.14]);

  // Flip up sights: a ring at the back, a post at the front, both on the rail.
  const flipSights = group([
    box(m.darkMetal, [0.024, 0.016, 0.014], [0, 0.042, 0.09]),
    ring(m.darkMetal, 0.0105, 0.0032, [0, sightY, 0.09], 12),
    box(m.darkMetal, [0.02, 0.016, 0.012], [0, 0.042, -0.16]),
    box(m.metal, [0.004, 0.024, 0.005], [0, sightY - 0.008, -0.16]),
    box(m.darkMetal, [0.004, 0.022, 0.012], [-0.009, sightY - 0.008, -0.16]),
    box(m.darkMetal, [0.004, 0.022, 0.012], [0.009, sightY - 0.008, -0.16]),
  ]);

  const charging = chargingHandle(m, 'top', { z: 0.06, y: 0.038 });

  const parts: THREE.Object3D[] = [
    // Polymer body, one piece from muzzle to buffer.
    box(m.polymer, [0.042, 0.056, 0.24], [0, 0.008, -0.02]),
    box(m.polymer, [0.046, 0.02, 0.2], [0, 0.036, -0.02]),
    rail(m.darkMetal, { length: 0.22, width: 0.024, position: [0, 0.046, -0.03] }),
    ejectionPortCut(m, { z: 0.024, y: 0.012, x: 0.022, length: 0.042 }),
    selector(m, { z: 0.05, y: -0.008, x: 0.021 }),
    triggerGroup(m, { z: 0.03, y: -0.03, radius: 0.023 }),
    // Grip is also the magazine well, so it is deeper than a normal grip.
    pistolGrip(m, { z: 0.062, angle: 0.14, length: 0.088, width: 0.03 }),
    box(m.polymer, [0.032, 0.09, 0.046], [0, -0.07, 0.062], [0.14, 0, 0]),
    // Short barrel with a plain thread protector.
    barrel(m.blued, { radius: 0.006, length: 0.14, z: -0.16, profile: 1.4 }),
    box(m.polymer, [0.036, 0.03, 0.11], [0, -0.006, -0.15]),
    muzzleDevice(m, 'plain', { radius: 0.006, z: -0.29 }),
    foregrip,
    // Telescoping wire stock and a single sling point.
    stock(m, 'wire', { z: 0.1, length: 0.12, y: 0.008 }),
    post(m.darkMetal, 0.008, 0.03, [0.024, 0.0, 0.1], 8).rotateZ(Math.PI / 2),
    slingLoop(m, [0.022, -0.014, 0.1]),
    flipSights,
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.305]),
    ejectionPort: anchor([0.028, 0.016, 0.024]),
    sight: anchor([0, sightY, 0.09]),
    bolt: charging,
    magazine: mag,
  });
}
