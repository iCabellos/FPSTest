import type * as THREE from 'three';
import {
  anchor,
  apertureRearSight,
  assemble,
  barrel,
  box,
  chargingHandle,
  ejectionPortCut,
  gasSystem,
  group,
  handguard,
  magazine,
  muzzleDevice,
  pin,
  pistolGrip,
  rail,
  selector,
  slingLoop,
  stock,
  triggerGroup,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * M4A1 carbine. Flat top upper with a full length rail, a removable carry
 * handle carrying the A2 aperture, a ribbed handguard over a mid length gas
 * system, and a collapsible stock.
 */
export function buildM4A1(m: WeaponMaterials): WeaponModel {
  const sightY = 0.082;

  const mag = magazine(m, 'curved', {
    material: m.darkMetal,
    position: [0, -0.028, -0.02],
    width: 0.03,
    depth: 0.062,
    height: 0.12,
    curve: 0.14,
  });

  const charging = chargingHandle(m, 'rear', { z: 0.132, y: 0.044 });

  const carryHandle = group([
    box(m.darkMetal, [0.03, 0.012, 0.15], [0, sightY + 0.012, 0]),
    box(m.darkMetal, [0.028, 0.03, 0.02], [0, sightY - 0.006, -0.062]),
    box(m.darkMetal, [0.03, 0.036, 0.022], [0, sightY - 0.008, 0.062]),
    ...apertureRearSight(m, 0.058, sightY, sightY - 0.024, 0.0085),
  ]);

  const parts: THREE.Object3D[] = [
    // Upper receiver, with the shell deflector behind the port.
    box(m.polymer, [0.044, 0.052, 0.28], [0, 0.026, -0.02]),
    box(m.polymer, [0.046, 0.016, 0.28], [0, 0.05, -0.02]),
    rail(m.darkMetal, { length: 0.27, width: 0.026, position: [0, 0.06, -0.02] }),
    ejectionPortCut(m, { z: 0.03, y: 0.022, x: 0.023, length: 0.06 }),
    box(m.polymer, [0.014, 0.026, 0.03], [0.024, 0.038, 0.062], [0, 0, -0.35]),
    tube(m.metal, 0.009, 0.009, 0.026, [0.022, 0.042, 0.078]),
    // Lower receiver and magazine well.
    box(m.polymer, [0.042, 0.05, 0.13], [0, -0.014, 0]),
    box(m.polymer, [0.04, 0.062, 0.072], [0, -0.03, -0.02], [0.06, 0, 0]),
    box(m.polymer, [0.044, 0.03, 0.08], [0, -0.004, 0.06]),
    pin(m.metal, 0.006, 0.048, [0, 0.006, 0.096]),
    pin(m.metal, 0.006, 0.048, [0, -0.006, -0.05]),
    box(m.metal, [0.026, 0.018, 0.05], [0.027, 0.0, 0.048]),
    selector(m, { z: 0.052, y: 0.004, x: 0.022 }),
    triggerGroup(m, { z: 0.03, y: -0.032, radius: 0.026 }),
    pistolGrip(m, { z: 0.064, angle: 0.3, length: 0.098, width: 0.038 }),
    // Barrel, gas system and handguard.
    barrel(m.blued, { radius: 0.009, length: 0.34, z: -0.28, profile: 1.7 }),
    gasSystem(m, { z: -0.36, radius: 0.014, tubeLength: 0.17, y: 0.006 }),
    handguard(m, {
      material: m.polymer,
      length: 0.19,
      radius: 0.026,
      z: -0.24,
      style: 'ribbed',
      vents: 3,
    }),
    muzzleDevice(m, 'flash', { radius: 0.009, z: -0.6 }),
    // Stock and sling points.
    stock(m, 'collapsible', { material: m.polymer, z: 0.1, length: 0.17 }),
    slingLoop(m, [0.026, -0.012, 0.1]),
    slingLoop(m, [0, -0.026, -0.33]),
    carryHandle,
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.63]),
    ejectionPort: anchor([0.03, 0.026, 0.03]),
    sight: anchor([0, sightY, 0.058]),
    bolt: charging,
    magazine: mag,
  });
}
