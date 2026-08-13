import type * as THREE from 'three';
import {
  anchor,
  assemble,
  barrel,
  box,
  chargingHandle,
  gasSystem,
  hoodedFrontPost,
  magazine,
  muzzleDevice,
  notchRearSight,
  pin,
  pistolGrip,
  post,
  slingLoop,
  stock,
  triggerGroup,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * AK-47. Stamped receiver with the big right hand selector plate, a gas tube
 * sitting above the barrel, wooden furniture, and the open notch rear sight
 * out on the barrel trunnion where the real one lives.
 */
export function buildAK47(m: WeaponMaterials): WeaponModel {
  const sightY = 0.062;

  const mag = magazine(m, 'curved', {
    material: m.rubber,
    position: [0, -0.026, -0.03],
    width: 0.032,
    depth: 0.068,
    height: 0.13,
    curve: 0.3,
  });

  // The AK's charging handle is part of the bolt carrier, on the right.
  const charging = chargingHandle(m, 'side', { z: 0.06, y: 0.036, x: 0.03 });

  const parts: THREE.Object3D[] = [
    // Receiver: a shallow stamped box with a domed top cover.
    box(m.darkMetal, [0.046, 0.05, 0.24], [0, 0.022, 0.01]),
    tube(m.darkMetal, 0.026, 0.026, 0.2, [0, 0.042, 0.02], 10),
    box(m.metal, [0.048, 0.006, 0.24], [0, -0.004, 0.01]),
    // Rear sight block and the gas tube above the handguard.
    box(m.darkMetal, [0.04, 0.018, 0.04], [0, 0.05, -0.09]),
    tube(m.metal, 0.014, 0.014, 0.19, [0, 0.036, -0.2], 10),
    // The famous selector plate, long and on the right.
    box(m.metal, [0.006, 0.075, 0.016], [0.026, 0.024, 0.048], [0, 0, 0.12]),
    box(m.metal, [0.006, 0.014, 0.05], [0.026, 0.05, 0.032]),
    pin(m.metal, 0.007, 0.05, [0, 0.0, 0.062]),
    // Barrel with the gas block canted over it, and a slant brake.
    barrel(m.blued, { radius: 0.0095, length: 0.4, z: -0.28, profile: 1.6 }),
    gasSystem(m, { z: -0.33, radius: 0.016, tubeLength: 0.02, y: 0.014 }),
    box(m.darkMetal, [0.03, 0.036, 0.05], [0, 0.014, -0.24], [0.35, 0, 0]),
    muzzleDevice(m, 'compensator', { radius: 0.0095, z: -0.615 }),
    // Wooden handguards, upper and lower, with the retainer ring.
    box(m.wood, [0.038, 0.036, 0.15], [0, -0.014, -0.19], [0.02, 0, 0]),
    box(m.wood, [0.034, 0.024, 0.14], [0, 0.03, -0.2]),
    tube(m.metal, 0.023, 0.023, 0.016, [0, -0.006, -0.115], 10),
    // Wooden thumbhole style stock and pistol grip.
    stock(m, 'fixed', { material: m.wood, z: 0.13, length: 0.2, y: 0.006 }),
    pistolGrip(m, { material: m.wood, z: 0.058, angle: 0.34, length: 0.092, width: 0.036 }),
    triggerGroup(m, { z: 0.026, y: -0.03, radius: 0.026 }),
    // Cleaning rod under the barrel, and sling swivels.
    post(m.metal, 0.0035, 0.3, [0, -0.024, -0.28], 6).rotateX(Math.PI / 2),
    slingLoop(m, [0, -0.03, -0.13]),
    slingLoop(m, [0, -0.026, 0.15]),
    ...hoodedFrontPost(m, -0.55, sightY, 0.022, 0.015, false),
    ...notchRearSight(m, -0.09, sightY, 0.058, 0.011),
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.645]),
    ejectionPort: anchor([0.032, 0.03, 0.04]),
    sight: anchor([0, sightY, -0.09]),
    bolt: charging,
    magazine: mag,
  });
}
