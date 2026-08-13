import type * as THREE from 'three';
import {
  anchor,
  assemble,
  ball,
  box,
  group,
  hollowTube,
  notchRearSight,
  pin,
  post,
  ring,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * .357 Magnum revolver. No slide and no magazine: a six shot cylinder with
 * visible chambers and brass in them, a vented rib along the top of a heavy
 * barrel, an ejector rod underneath, and an exposed hammer.
 *
 * Nothing detaches: the cylinder swings out and is refilled in place, so this
 * model deliberately nominates no magazine part. Dropping the middle of the
 * gun on the floor would look far worse than not animating a swap at all.
 */
export function buildRevolver(m: WeaponMaterials): WeaponModel {
  const sightY = 0.05;
  const cylinderZ = 0.012;

  const chambers: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 0.0165;
    const y = Math.sin(angle) * 0.0165;
    // A hole through the cylinder, with a case sitting in it.
    chambers.push(hollowTube(m.rubber, 0.0062, 0.05, [x, y, 0], 8));
    chambers.push(tube(m.brass, 0.0058, 0.0058, 0.026, [x, y, 0.011], 8));
    // Flute between each chamber, cut into the outside.
    const fluteAngle = angle + Math.PI / 6;
    chambers.push(
      box(
        m.rubber,
        [0.008, 0.008, 0.038],
        [Math.cos(fluteAngle) * 0.026, Math.sin(fluteAngle) * 0.026, 0],
        [0, 0, fluteAngle],
      ),
    );
  }

  const cylinder = group(
    [
      tube(m.blued, 0.026, 0.026, 0.048, [0, 0, 0], 18),
      tube(m.metal, 0.008, 0.008, 0.056, [0, 0, 0], 10),
      ...chambers,
    ],
    [0, 0, cylinderZ],
  );

  const hammer = group([
    box(m.metal, [0.008, 0.03, 0.012], [0, 0.03, 0.062], [-0.35, 0, 0]),
    box(m.darkMetal, [0.01, 0.012, 0.014], [0, 0.044, 0.07]),
    ...Array.from({ length: 3 }, (_unused, i) =>
      box(m.rubber, [0.011, 0.003, 0.008], [0, 0.046 + i * 0.004, 0.072]),
    ),
  ]);

  const parts: THREE.Object3D[] = [
    // Frame: top strap over the cylinder, and the recoil shield behind it.
    box(m.blued, [0.026, 0.02, 0.12], [0, 0.036, 0.01]),
    box(m.blued, [0.03, 0.07, 0.03], [0, 0.014, 0.056]),
    box(m.blued, [0.028, 0.05, 0.03], [0, 0.006, -0.036]),
    post(m.metal, 0.024, 0.006, [0, 0, 0.05], 14).rotateX(Math.PI / 2),
    // Heavy barrel with a vented rib on top and an underlug beneath.
    tube(m.blued, 0.013, 0.013, 0.17, [0, 0, -0.12]),
    hollowTube(m.rubber, 0.0062, 0.18, [0, 0, -0.12], 10),
    box(m.blued, [0.018, 0.014, 0.17], [0, 0.024, -0.12]),
    ...Array.from({ length: 6 }, (_unused, i) =>
      box(m.rubber, [0.02, 0.008, 0.008], [0, 0.024, -0.06 - i * 0.022]),
    ),
    box(m.blued, [0.02, 0.02, 0.15], [0, -0.02, -0.115]),
    // Ejector rod, running back into the underlug.
    tube(m.metal, 0.005, 0.005, 0.11, [0, -0.02, -0.06]),
    ball(m.metal, 0.008, [0, -0.02, -0.114]),
    // Crane and cylinder release on the left.
    box(m.metal, [0.006, 0.016, 0.03], [-0.016, 0.012, 0.042]),
    pin(m.metal, 0.005, 0.03, [0, 0, 0.012]),
    // Grip: full wooden target grip with finger grooves.
    box(m.wood, [0.032, 0.11, 0.056], [0, -0.08, 0.062], [0.3, 0, 0]),
    box(m.wood, [0.034, 0.014, 0.05], [0, -0.134, 0.086]),
    ...Array.from({ length: 3 }, (_unused, i) =>
      box(m.rubber, [0.035, 0.006, 0.012], [0, -0.055 - i * 0.024, 0.042 + i * 0.008], [0.3, 0, 0]),
    ),
    // Trigger and a big rounded guard.
    box(m.metal, [0.008, 0.026, 0.008], [0, -0.03, 0.014], [0.22, 0, 0]),
    ring(m.blued, 0.024, 0.004, [0, -0.03, 0.014], 14).rotateY(Math.PI / 2),
    hammer,
    cylinder,
    ...notchRearSight(m, 0.05, sightY, 0.044, 0.009),
    // Ramped front blade with a red insert.
    box(m.blued, [0.008, 0.018, 0.024], [0, sightY - 0.012, -0.19], [0.18, 0, 0]),
    box(m.metal, [0.005, 0.006, 0.006], [0, sightY - 0.003, -0.192]),
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0, -0.212]),
    // Nothing is ejected while firing; cases come out of the cylinder face.
    ejectionPort: anchor([0.02, 0.012, 0.012]),
    sight: anchor([0, sightY, 0.05]),
    bolt: hammer,
  });
}
