import type * as THREE from 'three';
import {
  anchor,
  assemble,
  beadFrontSight,
  box,
  ejectionPortCut,
  group,
  hollowTube,
  pin,
  pistolGrip,
  post,
  rail,
  ring,
  slingLoop,
  stock,
  triggerGroup,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/** Shells sitting in a tube magazine, visible through the loading port. */
function shellStack(m: WeaponMaterials, count: number, z: number, y: number): THREE.Object3D[] {
  return Array.from({ length: count }, (_unused, i) => {
    const shell = group([
      tube(m.brass, 0.0092, 0.0092, 0.012, [0, 0, 0.014]),
      tube(m.rubber, 0.0092, 0.0092, 0.05, [0, 0, -0.012]),
    ]);
    shell.position.set(0, y, z + i * 0.064);
    return shell;
  });
}

/**
 * Remington 870. Pump action: a wooden stock and forend, a tube magazine
 * slung under the barrel, and a bead on a ventilated rib. The forend is the
 * reciprocating part, so the pump stroke is what the action animation drives.
 */
export function buildRemington870(m: WeaponMaterials): WeaponModel {
  const sightY = 0.038;

  // The forend, which slides back and forth on the magazine tube.
  const forend = group([
    box(m.wood, [0.05, 0.05, 0.17], [0, -0.03, 0]),
    tube(m.wood, 0.026, 0.026, 0.17, [0, -0.03, 0], 12),
    ...Array.from({ length: 7 }, (_unused, i) =>
      box(m.rubber, [0.052, 0.006, 0.008], [0, -0.03, -0.06 + i * 0.02]),
    ),
  ], [0, 0, -0.22]);

  const parts: THREE.Object3D[] = [
    // Milled steel receiver, with the loading port underneath.
    box(m.blued, [0.042, 0.058, 0.19], [0, 0.006, 0.03]),
    box(m.blued, [0.044, 0.014, 0.19], [0, 0.036, 0.03]),
    ejectionPortCut(m, { z: 0.02, y: 0.006, x: 0.022, length: 0.06 }),
    box(m.rubber, [0.03, 0.008, 0.06], [0, -0.023, 0.03]),
    pin(m.metal, 0.006, 0.048, [0, -0.014, 0.096]),
    // Barrel with a vented rib along the top.
    tube(m.blued, 0.0155, 0.0155, 0.44, [0, 0, -0.26]),
    hollowTube(m.rubber, 0.0092, 0.45, [0, 0, -0.26], 12),
    box(m.blued, [0.016, 0.012, 0.42], [0, 0.026, -0.26]),
    ...Array.from({ length: 9 }, (_unused, i) =>
      box(m.rubber, [0.018, 0.007, 0.01], [0, 0.026, -0.1 - i * 0.044]),
    ),
    // Magazine tube with its end cap, and the shells inside it.
    tube(m.blued, 0.0125, 0.0125, 0.34, [0, -0.03, -0.22]),
    post(m.metal, 0.015, 0.016, [0, -0.03, -0.386], 12).rotateX(Math.PI / 2),
    ...shellStack(m, 4, -0.32, -0.03),
    forend,
    // Wooden stock and a plain trigger group.
    stock(m, 'fixed', { material: m.wood, z: 0.12, length: 0.22, y: 0.0 }),
    triggerGroup(m, { z: 0.05, y: -0.032, radius: 0.026 }),
    // Safety button through the back of the guard.
    post(m.metal, 0.006, 0.026, [0, -0.02, 0.082], 8).rotateZ(Math.PI / 2),
    slingLoop(m, [0, -0.05, -0.36]),
    slingLoop(m, [0, -0.034, 0.3]),
    ...beadFrontSight(m, -0.47, sightY, 0.03),
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.49]),
    ejectionPort: anchor([0.028, 0.01, 0.02]),
    // A bead has no rear sight, so the sight line is the rib itself.
    sight: anchor([0, sightY, 0.06]),
    bolt: forend,
  });
}

/**
 * SPAS-12. Bulky, black and aggressive: a heat shield over the barrel, a
 * folding stock hooked over the top, a pistol grip and a rail with a ghost
 * ring. Deliberately reads as the opposite of the 870's hunting lines.
 */
export function buildSpas12(m: WeaponMaterials): WeaponModel {
  const sightY = 0.076;

  const forend = group([
    box(m.polymer, [0.052, 0.052, 0.16], [0, -0.032, 0]),
    ...Array.from({ length: 6 }, (_unused, i) =>
      box(m.rubber, [0.054, 0.008, 0.01], [0, -0.032, -0.05 + i * 0.02]),
    ),
    box(m.polymer, [0.03, 0.028, 0.05], [0, -0.066, 0.05], [0.3, 0, 0]),
  ], [0, 0, -0.2]);

  const parts: THREE.Object3D[] = [
    // Heavy squared receiver.
    box(m.darkMetal, [0.05, 0.07, 0.22], [0, 0.008, 0.03]),
    box(m.darkMetal, [0.052, 0.016, 0.22], [0, 0.048, 0.03]),
    rail(m.darkMetal, { length: 0.16, width: 0.026, position: [0, 0.058, 0.01] }),
    ejectionPortCut(m, { z: 0.02, y: 0.008, x: 0.026, length: 0.062 }),
    pin(m.metal, 0.006, 0.054, [0, -0.02, 0.1]),
    // Barrel under a perforated heat shield.
    tube(m.blued, 0.016, 0.016, 0.34, [0, 0, -0.22]),
    hollowTube(m.rubber, 0.0095, 0.35, [0, 0, -0.22], 12),
    hollowTube(m.darkMetal, 0.026, 0.24, [0, 0, -0.24], 14),
    // Cooling holes punched straight through the shield, both sides at once.
    ...Array.from({ length: 6 }, (_unused, i) =>
      pin(m.rubber, 0.007, 0.056, [0, 0, -0.15 - i * 0.036], 6),
    ),
    // Magazine tube and its shells.
    tube(m.blued, 0.013, 0.013, 0.3, [0, -0.032, -0.2]),
    post(m.metal, 0.016, 0.016, [0, -0.032, -0.348], 12).rotateX(Math.PI / 2),
    ...shellStack(m, 3, -0.3, -0.032),
    forend,
    // Pistol grip, trigger group and the hook stock folded over the top.
    pistolGrip(m, { z: 0.1, angle: 0.3, length: 0.1, width: 0.038 }),
    triggerGroup(m, { z: 0.066, y: -0.04, radius: 0.028 }),
    box(m.darkMetal, [0.03, 0.02, 0.2], [0, 0.07, 0.16]),
    box(m.darkMetal, [0.026, 0.06, 0.024], [0, 0.046, 0.25]),
    ring(m.darkMetal, 0.028, 0.005, [0, 0.03, 0.264], 12).rotateY(Math.PI / 2),
    slingLoop(m, [0.028, 0.0, -0.3]),
    slingLoop(m, [0, -0.03, 0.14]),
    // Ghost ring rear over a hooded front post.
    box(m.darkMetal, [0.024, 0.018, 0.016], [0, 0.062, 0.06]),
    ring(m.darkMetal, 0.011, 0.0034, [0, sightY, 0.06], 12),
    box(m.darkMetal, [0.022, 0.03, 0.016], [0, 0.056, -0.36]),
    box(m.metal, [0.004, 0.026, 0.005], [0, sightY - 0.012, -0.36]),
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.4]),
    ejectionPort: anchor([0.03, 0.012, 0.02]),
    sight: anchor([0, sightY, 0.06]),
    bolt: forend,
  });
}
