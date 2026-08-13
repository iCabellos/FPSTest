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

/** Reels, and how many symbols are around each drum. */
export const REEL_COUNT = 5;
export const SYMBOLS_PER_REEL = 6;
/** Marquee bulbs around the cabinet face. */
export const BULB_COUNT = 14;

const REEL_RADIUS = 0.028;
const REEL_SPACING = 0.03;
/**
 * The reel bank sits on the roof, not inside the cabinet. Buried in the body
 * it was geometrically present and completely invisible, which is the worst of
 * both: cost without spectacle.
 */
const REEL_Y = 0.112;
const REEL_Z = -0.05;

/**
 * The special weapon: a fruit machine someone welded a barrel to.
 *
 * It is deliberately the loudest object in the game. Five real reel drums spin
 * on their own axles behind glass, a marquee of bulbs runs round the cabinet
 * face, a beacon turns on the roof and a jackpot lamp sits over the payout
 * horn. None of it is decoration the mode cannot reach: the reels, bulbs,
 * beacon and lamp are all handed back through `extras` so the animation can
 * spin them, chase them and flash them.
 *
 * Every symbol is built from geometry rather than painted onto a canvas
 * texture, so the model still builds headless in the test suite.
 */
export function buildSlotMachine(m: WeaponMaterials): WeaponModel {
  const sightY = 0.092;

  const lever = group(
    [
      post(m.chrome, 0.009, 0.14, [0, 0.07, 0]),
      ball(m.neonRed, 0.026, [0, 0.15, 0]),
      post(m.brass, 0.016, 0.014, [0, 0.004, 0], 10).rotateZ(Math.PI / 2),
    ],
    [0.082, 0.03, 0.06],
  );

  const reels: THREE.Object3D[] = [];
  for (let i = 0; i < REEL_COUNT; i++) {
    const x = -((REEL_COUNT - 1) / 2) * REEL_SPACING + i * REEL_SPACING;
    reels.push(buildReel(m, x));
  }

  // Marquee bulbs, ringing the BACK of the cabinet.
  //
  // This is the face the player actually looks at: the weapon points away
  // from them, so anything mounted on the muzzle end of the cabinet is
  // permanently out of sight. The whole light show lives where it can be seen.
  const bulbs: THREE.Object3D[] = [];
  const halfWidth = 0.082;
  const halfHeight = 0.076;
  for (let i = 0; i < BULB_COUNT; i++) {
    const angle = (i / BULB_COUNT) * Math.PI * 2;
    // Its own material per bulb. Sharing one would mean recolouring a single
    // bulb recolours the whole marquee, and the chase would be a single lamp
    // blinking rather than a run of light going round.
    bulbs.push(
      ball(m.neonAmber.clone(), 0.0095, [
        Math.cos(angle) * halfWidth,
        0.005 + Math.sin(angle) * halfHeight,
        0.094,
      ]),
    );
  }

  const beacon = group([
    post(m.chrome, 0.016, 0.008, [0, 0, 0], 12),
    post(m.neonRed, 0.014, 0.026, [0, 0.017, 0], 12),
    // A blade sticking out of the light, so the rotation is visible.
    box(m.neonPink, [0.03, 0.02, 0.006], [0.012, 0.017, 0]),
  ]);
  beacon.position.set(0, 0.166, -0.05);

  // Payout display, in the middle of the marquee on the back panel.
  const jackpotLamp = group([
    box(m.chrome, [0.11, 0.028, 0.016], [0, 0, 0]),
    // Cloned too: the strobe drives emissive intensity, and the shared green
    // is also on every nuclear reel face.
    box(m.neonGreen.clone(), [0.096, 0.02, 0.01], [0, 0, 0.008]),
  ]);
  jackpotLamp.position.set(0, -0.03, 0.098);

  const parts: THREE.Object3D[] = [
    // Cast cabinet body with a chrome face plate and corner posts.
    box(m.darkMetal, [0.15, 0.13, 0.3], [0, 0.005, -0.06]),
    box(m.brass, [0.156, 0.012, 0.3], [0, 0.072, -0.06]),
    box(m.brass, [0.156, 0.012, 0.3], [0, -0.062, -0.06]),
    ...([-1, 1] as const).flatMap((side) =>
      ([-1, 1] as const).map((end) =>
        post(m.chrome, 0.009, 0.13, [side * 0.076, 0.005, -0.06 + end * 0.148], 8),
      ),
    ),
    box(m.chrome, [0.144, 0.094, 0.012], [0, 0.004, -0.209]),
    // Back plate, behind the marquee.
    box(m.darkMetal, [0.15, 0.126, 0.012], [0, 0.005, 0.088]),
    // Neon strips down both flanks.
    ...([-1, 1] as const).map((side) =>
      box(m.neonBlue, [0.006, 0.09, 0.26], [side * 0.077, 0.005, -0.06]),
    ),
    // Reel housing on the roof, open toward the player with the glass on that
    // side, so the drums are read from behind rather than from the muzzle end.
    box(m.chrome, [0.152, 0.012, 0.12], [0, REEL_Y - 0.038, REEL_Z]),
    box(m.chrome, [0.152, 0.012, 0.12], [0, REEL_Y + 0.038, REEL_Z]),
    ...([-1, 1] as const).map((side) =>
      box(m.chrome, [0.012, 0.078, 0.12], [side * 0.07, REEL_Y, REEL_Z]),
    ),
    box(m.neonPink, [0.152, 0.006, 0.12], [0, REEL_Y + 0.045, REEL_Z]),
    box(m.windowGlass, [0.136, 0.062, 0.004], [0, REEL_Y, REEL_Z + 0.062]),
    ...reels,
    // Coin tray under the nose, and the payout horn grenades leave from.
    box(m.chrome, [0.1, 0.028, 0.05], [0, -0.062, -0.16]),
    box(m.rubber, [0.086, 0.006, 0.038], [0, -0.05, -0.16]),
    tube(m.brass, 0.05, 0.026, 0.14, [0, -0.005, -0.29], 14),
    hollowTube(m.neonAmber, 0.04, 0.06, [0, -0.005, -0.32], 14),
    ring(m.chrome, 0.052, 0.007, [0, -0.005, -0.356], 16),
    // Wooden shoulder furniture, because it still has to be shot from the hip.
    stock(m, 'fixed', { material: m.wood, z: 0.1, length: 0.16, y: 0.006 }),
    pistolGrip(m, { material: m.wood, z: 0.06, angle: 0.24, length: 0.1, width: 0.04 }),
    triggerGroup(m, { z: 0.03, y: -0.036, radius: 0.028 }),
    pin(m.brass, 0.008, 0.16, [0, -0.05, -0.02]),
    slingLoop(m, [0, -0.072, -0.16]),
    slingLoop(m, [0, -0.03, 0.12]),
    ...notchRearSight(m, 0.07, sightY, 0.086, 0.013),
    ...hoodedFrontPost(m, -0.23, sightY, 0.074, 0.014, true),
    ...bulbs,
    beacon,
    jackpotLamp,
    lever,
  ];

  return assemble(parts, {
    muzzle: anchor([0, -0.005, -0.36]),
    // Coins drop out of the right hand tray, same side as every ejector.
    ejectionPort: anchor([0.052, -0.05, -0.16]),
    sight: anchor([0, sightY, 0.07]),
    bolt: lever,
    extras: { reels, bulbs, beacon: [beacon], jackpotLamp: [jackpotLamp] },
  });
}

/**
 * One reel: a drum of symbol faces on an axle across the weapon. Rotating the
 * group about X brings each face up to the window in turn, exactly like the
 * real thing.
 */
function buildReel(m: WeaponMaterials, x: number): THREE.Group {
  const faces: THREE.Object3D[] = [
    // The drum itself, and its axle.
    post(m.darkMetal, REEL_RADIUS * 0.72, 0.024, [0, 0, 0], 14).rotateZ(Math.PI / 2),
    post(m.chrome, 0.004, 0.034, [0, 0, 0], 8).rotateZ(Math.PI / 2),
  ];

  for (let i = 0; i < SYMBOLS_PER_REEL; i++) {
    const angle = (i / SYMBOLS_PER_REEL) * Math.PI * 2;
    const y = Math.sin(angle) * REEL_RADIUS;
    const z = Math.cos(angle) * REEL_RADIUS;
    // Two of six are nuclear, two grenade, two blank: the reel strip.
    const kind = i % 3;
    const plate = box(
      kind === 0 ? m.neonRed : kind === 1 ? m.neonAmber : m.neonGreen,
      [0.02, 0.024, 0.004],
      [0, y, z],
      [-angle, 0, 0],
    );
    faces.push(plate);
    faces.push(...symbol(m, kind, y, z, angle));
  }

  const reel = group(faces, [x, REEL_Y, REEL_Z]);
  return reel;
}

/** The mark on a reel face: a cross, a ring, or a trefoil. */
function symbol(
  m: WeaponMaterials,
  kind: number,
  y: number,
  z: number,
  angle: number,
): THREE.Object3D[] {
  const lift = 0.004;
  const oy = y + Math.sin(angle) * lift;
  const oz = z + Math.cos(angle) * lift;
  const rotation: [number, number, number] = [-angle, 0, 0];

  if (kind === 0) {
    // X: two crossed bars.
    return [
      box(m.chrome, [0.003, 0.016, 0.002], [0, oy, oz], [-angle, 0, 0.7]),
      box(m.chrome, [0.003, 0.016, 0.002], [0, oy, oz], [-angle, 0, -0.7]),
    ];
  }
  if (kind === 1) {
    // Grenade: a ring.
    const mark = ring(m.chrome, 0.006, 0.0018, [0, oy, oz], 10);
    mark.rotation.set(-angle, 0, 0);
    return [mark];
  }
  // Nuclear: three spokes.
  return [0, 1, 2].map((i) =>
    box(m.chrome, [0.0028, 0.014, 0.002], [0, oy, oz], [
      rotation[0],
      0,
      (i / 3) * Math.PI * 2,
    ]),
  );
}
