import type * as THREE from 'three';
import {
  anchor,
  assemble,
  barrel,
  box,
  group,
  magazine,
  muzzleDevice,
  pin,
  post,
  rail,
  scope,
  slingLoop,
  triggerGroup,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * L96A1. Bolt action: a heavy fluted barrel, a thumbhole stock with an
 * adjustable cheek piece and monopod, a folding bipod, and a 6× scope. The
 * bolt handle is the animated part, so it is built standing out to the right
 * where it can be seen cycling.
 */
export function buildL96(m: WeaponMaterials): WeaponModel {
  const sightY = 0.108;

  const mag = magazine(m, 'straight', {
    material: m.darkMetal,
    position: [0, -0.03, -0.03],
    width: 0.028,
    depth: 0.07,
    height: 0.075,
  });

  // Bolt handle: a shaft out to the right with a ball on the end.
  const boltHandle = group([
    box(m.metal, [0.05, 0.014, 0.016], [0.03, 0.03, 0]),
    post(m.metal, 0.007, 0.03, [0.05, 0.024, 0], 8).rotateZ(0.5),
    post(m.darkMetal, 0.012, 0.012, [0.056, 0.012, 0], 10),
  ]);
  boltHandle.position.set(0, 0, 0.1);

  const bipod = group([
    post(m.darkMetal, 0.006, 0.18, [-0.03, -0.07, 0], 8).rotateZ(-0.22),
    post(m.darkMetal, 0.006, 0.18, [0.03, -0.07, 0], 8).rotateZ(0.22),
    box(m.darkMetal, [0.05, 0.016, 0.034], [0, 0.006, 0]),
  ], [0, -0.028, -0.34]);

  const parts: THREE.Object3D[] = [
    // Receiver, bedded into the stock, with a rail on top for the scope.
    box(m.darkMetal, [0.038, 0.046, 0.24], [0, 0.022, 0.06]),
    tube(m.darkMetal, 0.022, 0.022, 0.22, [0, 0.026, 0.06], 12),
    rail(m.darkMetal, { length: 0.2, width: 0.026, position: [0, 0.05, 0.06] }),
    // Heavy fluted barrel: the flutes are what say "target rifle" at a glance.
    barrel(m.blued, { radius: 0.014, length: 0.8, z: -0.45, profile: 1.3 }),
    ...Array.from({ length: 6 }, (_unused, i) => {
      const angle = (i / 6) * Math.PI * 2;
      return post(m.rubber, 0.0035, 0.52, [
        Math.cos(angle) * 0.0135,
        Math.sin(angle) * 0.0135,
        -0.5,
      ], 6).rotateX(Math.PI / 2);
    }),
    muzzleDevice(m, 'brake', { radius: 0.014, z: -0.87 }),
    // Thumbhole stock with a cheek piece and an adjustable butt.
    box(m.polymer, [0.042, 0.06, 0.42], [0, -0.032, -0.02]),
    box(m.polymer, [0.044, 0.09, 0.14], [0, -0.028, 0.2]),
    box(m.rubber, [0.05, 0.042, 0.05], [0, -0.03, 0.235]),
    box(m.polymer, [0.036, 0.03, 0.12], [0, 0.05, 0.22]),
    post(m.metal, 0.006, 0.03, [-0.012, 0.03, 0.19], 8),
    post(m.metal, 0.006, 0.03, [0.012, 0.03, 0.19], 8),
    box(m.polymer, [0.046, 0.11, 0.03], [0, -0.03, 0.29]),
    box(m.rubber, [0.048, 0.104, 0.014], [0, -0.03, 0.312]),
    post(m.darkMetal, 0.007, 0.06, [0, -0.086, 0.28], 8),
    // Forend and the front rail the bipod hangs from.
    box(m.polymer, [0.046, 0.05, 0.3], [0, -0.03, -0.28]),
    rail(m.darkMetal, { length: 0.14, width: 0.022, position: [0, -0.056, -0.32] }),
    bipod,
    pin(m.metal, 0.006, 0.05, [0, -0.006, 0.13]),
    triggerGroup(m, { z: 0.05, y: -0.03, radius: 0.024 }),
    slingLoop(m, [0, -0.058, -0.16]),
    slingLoop(m, [0, -0.062, 0.24]),
    ...scope(m, { z: 0.06, sightY, length: 0.3, radius: 0.022 }),
    boltHandle,
    mag,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.9]),
    ejectionPort: anchor([0.03, 0.036, 0.09]),
    sight: anchor([0, sightY, 0.21]),
    bolt: boltHandle,
    magazine: mag,
  });
}
