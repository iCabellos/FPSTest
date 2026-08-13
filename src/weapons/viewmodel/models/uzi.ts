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
  post,
  slingLoop,
  stock,
  triggerGroup,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * Uzi. A stamped steel box with the magazine feeding through the pistol grip,
 * a ribbed top cover with the cocking knob riding down the middle of it, and
 * a folding metal stock. Short, wide and unmistakable from above.
 */
export function buildUzi(m: WeaponMaterials): WeaponModel {
  const sightY = 0.06;

  // Magazine goes through the grip, which is what makes an Uzi an Uzi.
  const mag = magazine(m, 'straight', {
    material: m.darkMetal,
    position: [0, -0.108, 0.03],
    width: 0.028,
    depth: 0.05,
    height: 0.11,
  });

  const charging = chargingHandle(m, 'top', { z: -0.03, y: 0.048 });

  // Ribs stamped along the top cover.
  const ribs = group(
    Array.from({ length: 7 }, (_unused, i) =>
      box(m.darkMetal, [0.052, 0.006, 0.008], [0, 0.044, -0.08 + i * 0.024]),
    ),
  );

  const parts: THREE.Object3D[] = [
    // Stamped receiver: wide, shallow, square.
    box(m.darkMetal, [0.056, 0.058, 0.21], [0, 0.018, -0.02]),
    box(m.darkMetal, [0.058, 0.012, 0.21], [0, 0.044, -0.02]),
    ribs,
    ejectionPortCut(m, { z: 0.0, y: 0.018, x: 0.03, length: 0.05 }),
    pin(m.metal, 0.006, 0.06, [0, -0.006, 0.07]),
    // Grip and magazine housing, one assembly under the receiver.
    pistolGrip(m, { material: m.rubber, z: 0.03, angle: 0.05, length: 0.096, width: 0.036 }),
    box(m.darkMetal, [0.038, 0.09, 0.056], [0, -0.062, 0.03]),
    box(m.metal, [0.042, 0.014, 0.06], [0, -0.108, 0.03]),
    triggerGroup(m, { z: -0.006, y: -0.032, radius: 0.026 }),
    // Grip safety at the back of the grip.
    box(m.rubber, [0.03, 0.06, 0.008], [0, -0.06, 0.058], [0.05, 0, 0]),
    // Short barrel with its retaining nut and a plain muzzle.
    barrel(m.blued, { radius: 0.007, length: 0.16, z: -0.16, profile: 1.4 }),
    post(m.metal, 0.017, 0.014, [0, 0, -0.108], 12).rotateX(Math.PI / 2),
    muzzleDevice(m, 'plain', { radius: 0.007, z: -0.245 }),
    // Underfolding metal stock.
    stock(m, 'wire', { z: 0.09, length: 0.14, y: -0.006 }),
    slingLoop(m, [-0.03, 0.0, -0.09]),
    slingLoop(m, [0, -0.014, 0.1]),
    ...notchRearSight(m, 0.06, sightY, 0.05, 0.01),
    ...hoodedFrontPost(m, -0.14, sightY, 0.02, 0.015, true),
    charging,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.26]),
    ejectionPort: anchor([0.034, 0.022, 0]),
    sight: anchor([0, sightY, 0.06]),
    bolt: charging,
    magazine: mag,
  });
}
