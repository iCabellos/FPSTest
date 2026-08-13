import type * as THREE from 'three';
import {
  anchor,
  assemble,
  barrel,
  box,
  chargingHandle,
  earedFrontBlade,
  ejectionPortCut,
  group,
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
 * M60. Belt fed, so the part that gets replaced on a reload is the belt itself
 * rather than a box magazine — it hangs out of the feed tray, link by link,
 * and the reload animation drops it away and feeds a fresh one.
 */
export function buildM60(m: WeaponMaterials): WeaponModel {
  const sightY = 0.114;

  const links: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const drop = i * 0.02;
    const lean = i * 0.005;
    links.push(
      box(m.brass, [0.012, 0.032, 0.012], [-lean, -drop, i * 0.006]),
      box(m.darkMetal, [0.017, 0.009, 0.015], [-lean, -0.018 - drop, i * 0.006]),
    );
  }
  const belt = group(links, [-0.03, -0.03, 0.02]);

  const bipod = group([
    post(m.darkMetal, 0.006, 0.16, [-0.012, -0.06, 0], 8).rotateX(0.28),
    post(m.darkMetal, 0.006, 0.16, [0.012, -0.06, 0], 8).rotateX(0.28),
    box(m.darkMetal, [0.04, 0.014, 0.03], [0, 0.004, 0]),
  ], [0, 0, -0.4]);

  const carryHandle = group([
    box(m.metal, [0.014, 0.05, 0.02], [0, 0.05, 0.05]),
    box(m.metal, [0.014, 0.05, 0.02], [0, 0.05, -0.05]),
    box(m.polymer, [0.02, 0.016, 0.13], [0, 0.078, 0]),
  ], [0, 0, -0.26]);

  const charging = chargingHandle(m, 'side', { z: 0.03, y: 0.02, x: 0.034 });

  const parts: THREE.Object3D[] = [
    // Receiver and the hinged feed tray cover.
    box(m.darkMetal, [0.058, 0.062, 0.3], [0, 0.028, 0.02]),
    box(m.darkMetal, [0.062, 0.018, 0.24], [0, 0.062, 0.01]),
    box(m.metal, [0.064, 0.008, 0.1], [0, 0.072, -0.05]),
    ejectionPortCut(m, { z: 0.02, y: 0.02, x: 0.03, length: 0.08 }),
    pin(m.metal, 0.008, 0.07, [0, 0.062, 0.12]),
    // Barrel with its perforated shroud, gas cylinder and carry handle.
    barrel(m.blued, { radius: 0.012, length: 0.42, z: -0.34, profile: 1.5 }),
    muzzleDevice(m, 'shroud', { radius: 0.012, z: -0.42 }),
    muzzleDevice(m, 'flash', { radius: 0.012, z: -0.72 }),
    tube(m.darkMetal, 0.014, 0.014, 0.26, [0, -0.028, -0.32], 10),
    carryHandle,
    bipod,
    // Furniture: shoulder stock, pistol grip, forward grip.
    stock(m, 'skeleton', { material: m.polymer, z: 0.17, length: 0.19, y: 0.01 }),
    pistolGrip(m, { z: 0.08, angle: 0.32, length: 0.1, width: 0.04 }),
    triggerGroup(m, { z: 0.048, y: -0.03, radius: 0.028 }),
    box(m.polymer, [0.03, 0.07, 0.05], [0, -0.052, -0.2], [0.22, 0, 0]),
    slingLoop(m, [0, -0.05, -0.3]),
    slingLoop(m, [0, -0.028, 0.2]),
    ...notchRearSight(m, 0.02, sightY, 0.078, 0.012),
    ...earedFrontBlade(m, -0.44, sightY, 0.056),
    charging,
    belt,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.75]),
    ejectionPort: anchor([0.038, 0.026, 0.02]),
    sight: anchor([0, sightY, 0.02]),
    bolt: charging,
    magazine: belt,
  });
}
