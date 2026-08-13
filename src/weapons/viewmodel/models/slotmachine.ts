import type * as THREE from 'three';
import {
  anchor,
  assemble,
  ball,
  box,
  group,
  hollowTube,
  hoodedFrontPost,
  notchRearSight,
  pin,
  pistolGrip,
  post,
  ring,
  slingLoop,
  stock,
  triggerGroup,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

/**
 * The special weapon: a fruit machine someone welded a barrel to.
 *
 * Five reel windows sit across the top deck where the player can read them,
 * the payout horn replaces a muzzle brake, and the arm on the right is the
 * "trigger" you see slam down on every pull — it is nominated as the action,
 * so the lever throw is what animates on each spin.
 */
export function buildSlotMachine(m: WeaponMaterials): WeaponModel {
  const sightY = 0.078;

  const lever = group([
    post(m.metal, 0.008, 0.13, [0, 0.065, 0]),
    ball(m.rubber, 0.024, [0, 0.14, 0]),
    post(m.brass, 0.014, 0.012, [0, 0.004, 0], 10).rotateZ(Math.PI / 2),
  ], [0.078, 0.03, 0.06]);

  // Reel windows, evenly spaced across the deck rather than placed by hand.
  const reels: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.052 + i * 0.026;
    reels.push(
      box(m.glass, [0.02, 0.028, 0.03], [x, 0.058, -0.06]),
      box(m.brass, [0.024, 0.004, 0.034], [x, 0.044, -0.06]),
      box(m.brass, [0.024, 0.004, 0.034], [x, 0.073, -0.06]),
      // The reel drum behind the glass.
      post(m.darkMetal, 0.012, 0.019, [x, 0.058, -0.06], 10).rotateZ(Math.PI / 2),
    );
  }

  const parts: THREE.Object3D[] = [
    // Cast cabinet body with a brass face plate and corner posts.
    box(m.darkMetal, [0.15, 0.13, 0.3], [0, 0.005, -0.06]),
    box(m.brass, [0.156, 0.012, 0.3], [0, 0.072, -0.06]),
    box(m.brass, [0.156, 0.012, 0.3], [0, -0.062, -0.06]),
    ...([-1, 1] as const).flatMap((side) =>
      ([-1, 1] as const).map((end) =>
        post(m.brass, 0.008, 0.13, [side * 0.076, 0.005, -0.06 + end * 0.148], 8),
      ),
    ),
    box(m.metal, [0.14, 0.09, 0.014], [0, 0, -0.208]),
    // Top deck the reels are set into.
    box(m.metal, [0.144, 0.014, 0.09], [0, 0.04, -0.06]),
    ...reels,
    // Coin tray under the nose, and the payout horn grenades leave from.
    box(m.metal, [0.1, 0.028, 0.05], [0, -0.062, -0.16]),
    box(m.rubber, [0.086, 0.006, 0.038], [0, -0.05, -0.16]),
    tube(m.brass, 0.05, 0.026, 0.14, [0, -0.005, -0.29], 14),
    hollowTube(m.rubber, 0.04, 0.06, [0, -0.005, -0.32], 14),
    ring(m.brass, 0.052, 0.007, [0, -0.005, -0.356], 16),
    // Wooden shoulder furniture, because it still has to be shot from the hip.
    stock(m, 'fixed', { material: m.wood, z: 0.1, length: 0.16, y: 0.006 }),
    pistolGrip(m, { material: m.wood, z: 0.06, angle: 0.24, length: 0.1, width: 0.04 }),
    triggerGroup(m, { z: 0.03, y: -0.036, radius: 0.028 }),
    pin(m.brass, 0.008, 0.16, [0, -0.05, -0.02]),
    slingLoop(m, [0, -0.072, -0.16]),
    slingLoop(m, [0, -0.03, 0.12]),
    ...notchRearSight(m, 0.07, sightY, 0.072, 0.013),
    ...hoodedFrontPost(m, -0.23, sightY, 0.062, 0.014, true),
    lever,
  ];

  return assemble(parts, {
    muzzle: anchor([0, -0.005, -0.36]),
    // Coins drop out of the right hand tray, same side as every ejector.
    ejectionPort: anchor([0.052, -0.05, -0.16]),
    sight: anchor([0, sightY, 0.07]),
    bolt: lever,
  });
}
