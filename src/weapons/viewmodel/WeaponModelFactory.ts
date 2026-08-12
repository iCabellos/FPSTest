import * as THREE from 'three';
import type { WeaponId } from '../WeaponDefinition';

/**
 * Placeholder first person models built from primitives.
 *
 * Every weapon is laid out in the same local space: the bore line is Y = 0,
 * the muzzle points down -Z, and the receiver sits around the origin. Sights
 * are built on a shared sight line so aiming lines up automatically, but each
 * weapon gets the sight picture it is known for rather than a shared part.
 *
 * Swapping in a GLB only requires returning the same anchors from
 * {@link createWeaponModel}.
 */
export interface WeaponModel {
  group: THREE.Group;
  /** Bullets, flash and smoke originate here. */
  muzzle: THREE.Object3D;
  /** Brass is thrown from here. */
  ejectionPort: THREE.Object3D;
  /** Point aligned with the screen centre when aiming. */
  sight: THREE.Object3D;
  /** Reciprocating part animated on each shot (and on the bolt cycle). */
  bolt: THREE.Object3D | null;
  /** Detached and replaced during the reload animation. */
  magazine: THREE.Object3D | null;
}

export interface WeaponMaterials {
  metal: THREE.Material;
  darkMetal: THREE.Material;
  polymer: THREE.Material;
  wood: THREE.Material;
  rubber: THREE.Material;
  glass: THREE.Material;
}

export function createWeaponMaterials(): WeaponMaterials {
  return {
    metal: new THREE.MeshPhongMaterial({ color: 0x8d939b, shininess: 70, specular: 0x4a4f55 }),
    darkMetal: new THREE.MeshPhongMaterial({ color: 0x4b5057, shininess: 45, specular: 0x33373c }),
    polymer: new THREE.MeshPhongMaterial({ color: 0x565a52, shininess: 16, specular: 0x1d1f19 }),
    wood: new THREE.MeshPhongMaterial({ color: 0x8f5b2c, shininess: 24, specular: 0x33200f }),
    rubber: new THREE.MeshPhongMaterial({ color: 0x2e3134, shininess: 6, specular: 0x101112 }),
    glass: new THREE.MeshPhongMaterial({
      color: 0x0d2237,
      emissive: 0x14364f,
      shininess: 120,
      specular: 0x9ac7ff,
    }),
  };
}

export function disposeWeaponMaterials(materials: WeaponMaterials): void {
  for (const material of Object.values(materials)) material.dispose();
}

type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function box(
  material: THREE.Material,
  size: Vec3,
  position: Vec3,
  rotation?: Vec3,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  return mesh;
}

/** Cylinder aligned with -Z, which is the weapon's forward axis. */
function tube(
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  length: number,
  position: Vec3,
  segments = 10,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  return mesh;
}

/** Open ended tube along -Z: you can see straight through it. */
function hollowTube(
  material: THREE.Material,
  radius: number,
  length: number,
  position: Vec3,
  segments = 10,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments, 1, true),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  return mesh;
}

/** Cylinder standing on the Y axis, for knobs and drums. */
function post(
  material: THREE.Material,
  radius: number,
  length: number,
  position: Vec3,
  segments = 8,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  mesh.position.set(...position);
  return mesh;
}

/** Ring lying in the XY plane, so it reads as a sight aperture from behind. */
function ring(
  material: THREE.Material,
  radius: number,
  thickness: number,
  position: Vec3,
  segments = 12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 5, segments), material);
  mesh.position.set(...position);
  return mesh;
}

function ball(material: THREE.Material, radius: number, position: Vec3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), material);
  mesh.position.set(...position);
  return mesh;
}

function anchor(position: Vec3): THREE.Object3D {
  const object = new THREE.Object3D();
  object.position.set(...position);
  return object;
}

function group(children: THREE.Object3D[], position: Vec3 = [0, 0, 0]): THREE.Group {
  const node = new THREE.Group();
  node.add(...children);
  node.position.set(...position);
  return node;
}

// ---------------------------------------------------------------------------
// Shared sub assemblies
// ---------------------------------------------------------------------------

/** Pistol grip with a trigger and a trigger guard loop. */
function gripAssembly(
  m: WeaponMaterials,
  material: THREE.Material,
  z: number,
  angle: number,
  length = 0.1,
): THREE.Object3D[] {
  return [
    box(material, [0.036, length, 0.045], [0, -0.03 - length / 2, z], [angle, 0, 0]),
    box(m.darkMetal, [0.03, 0.008, 0.07], [0, -0.036, z - 0.035]),
    box(m.darkMetal, [0.028, 0.03, 0.008], [0, -0.024, z - 0.066]),
    box(m.metal, [0.006, 0.022, 0.008], [0, -0.026, z - 0.04], [0.2, 0, 0]),
  ];
}

/** Straight box magazine. */
function straightMagazine(
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  position: Vec3,
  tilt = 0,
): THREE.Group {
  return group(
    [
      box(material, [width, height, depth], [0, -height / 2, 0], [tilt, 0, 0]),
      box(material, [width + 0.004, 0.012, depth + 0.004], [0, -height + 0.01, -height * tilt]),
    ],
    position,
  );
}

/** Banana magazine built from stacked, progressively tilted segments. */
function curvedMagazine(
  material: THREE.Material,
  width: number,
  depth: number,
  position: Vec3,
  segments = 3,
  curve = 0.28,
): THREE.Group {
  const parts: THREE.Object3D[] = [];
  let y = 0;
  let z = 0;
  for (let i = 0; i < segments; i++) {
    const height = 0.058;
    const tilt = -curve * i;
    y -= height * 0.86;
    z -= Math.sin(curve * i) * height * 0.9;
    parts.push(box(material, [width, height, depth], [0, y, z], [tilt, 0, 0]));
  }
  return group(parts, position);
}

/** Front sight post standing on the sight line, with side protection. */
function wingedFrontPost(m: WeaponMaterials, z: number, sightY: number, baseY: number): THREE.Object3D[] {
  const height = sightY - baseY + 0.012;
  return [
    box(m.darkMetal, [0.026, 0.014, 0.03], [0, baseY, z]),
    box(m.darkMetal, [0.005, height, 0.006], [0, baseY + height / 2, z]),
    box(m.darkMetal, [0.004, height * 0.9, 0.02], [-0.013, baseY + height / 2, z]),
    box(m.darkMetal, [0.004, height * 0.9, 0.02], [0.013, baseY + height / 2, z]),
  ];
}

/** Post inside a full hood: the HK and AK style front sight. */
function hoodedFrontPost(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  baseY: number,
  radius: number,
  full: boolean,
): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [
    box(m.darkMetal, [0.028, 0.016, 0.032], [0, baseY, z]),
    box(m.darkMetal, [0.004, sightY - baseY, 0.005], [0, (sightY + baseY) / 2, z]),
  ];
  if (full) {
    parts.push(ring(m.darkMetal, radius, 0.0028, [0, sightY, z]));
  } else {
    // Open topped hood: two uprights joined by a bridge.
    parts.push(
      box(m.darkMetal, [0.004, radius * 2, 0.026], [-radius, sightY - radius * 0.1, z]),
      box(m.darkMetal, [0.004, radius * 2, 0.026], [radius, sightY - radius * 0.1, z]),
      box(m.darkMetal, [radius * 2, 0.004, 0.026], [0, sightY + radius, z]),
    );
  }
  return parts;
}

/** Blade front sight between two tall ears, as used on belt fed guns. */
function earedFrontBlade(m: WeaponMaterials, z: number, sightY: number, baseY: number): THREE.Object3D[] {
  return [
    box(m.darkMetal, [0.03, 0.012, 0.034], [0, baseY, z]),
    box(m.metal, [0.004, sightY - baseY, 0.008], [0, (sightY + baseY) / 2, z]),
    box(m.darkMetal, [0.005, (sightY - baseY) * 1.15, 0.022], [-0.014, (sightY + baseY) / 2, z]),
    box(m.darkMetal, [0.005, (sightY - baseY) * 1.15, 0.022], [0.014, (sightY + baseY) / 2, z]),
  ];
}

/**
 * Open U notch: two uprights with a gap between them. Reads completely
 * differently from an aperture when you look through it.
 */
function notchRearSight(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  baseY: number,
  gap: number,
): THREE.Object3D[] {
  const wallHeight = sightY - baseY + 0.014;
  return [
    box(m.darkMetal, [0.05, 0.012, 0.03], [0, baseY, z]),
    box(m.darkMetal, [0.014, wallHeight, 0.012], [-gap / 2 - 0.007, baseY + wallHeight / 2, z]),
    box(m.darkMetal, [0.014, wallHeight, 0.012], [gap / 2 + 0.007, baseY + wallHeight / 2, z]),
    // Floor of the notch, level with the sight line.
    box(m.darkMetal, [gap, 0.004, 0.012], [0, sightY - 0.008, z]),
  ];
}

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

function buildM4A1(m: WeaponMaterials): WeaponModel {
  const sightY = 0.083;
  const charging = box(m.metal, [0.05, 0.016, 0.05], [0, 0.052, 0.115]);
  const magazine = curvedMagazine(m.polymer, 0.03, 0.062, [0, -0.05, -0.015], 3, 0.1);

  const parts: THREE.Object3D[] = [
    // Upper and lower receiver.
    box(m.darkMetal, [0.048, 0.055, 0.23], [0, 0.024, -0.05]),
    box(m.darkMetal, [0.044, 0.048, 0.15], [0, -0.026, 0.005]),
    box(m.darkMetal, [0.042, 0.05, 0.075], [0, -0.03, -0.05]),
    box(m.metal, [0.05, 0.02, 0.055], [0.006, 0.03, 0.02]),
    // Round handguard with heat shield ribs.
    tube(m.polymer, 0.028, 0.028, 0.2, [0, 0.014, -0.27], 10),
    tube(m.darkMetal, 0.03, 0.03, 0.008, [0, 0.014, -0.19], 10),
    tube(m.darkMetal, 0.03, 0.03, 0.008, [0, 0.014, -0.35], 10),
    // Barrel and flash hider.
    tube(m.metal, 0.009, 0.009, 0.24, [0, 0.014, -0.47]),
    tube(m.darkMetal, 0.014, 0.012, 0.05, [0, 0.014, -0.6], 8),
    // Gas block under the front sight tower.
    box(m.darkMetal, [0.028, 0.03, 0.035], [0, 0.035, -0.4]),
    // Buffer tube and stock.
    tube(m.darkMetal, 0.017, 0.017, 0.2, [0, 0.024, 0.19], 10),
    box(m.polymer, [0.04, 0.058, 0.13], [0, 0.016, 0.19]),
    box(m.polymer, [0.045, 0.075, 0.022], [0, 0.008, 0.28]),
    ...gripAssembly(m, m.polymer, 0.06, 0.3),
    // A2 carry handle: side plates, bridge, and the aperture inside it.
    box(m.darkMetal, [0.005, 0.026, 0.12], [-0.023, 0.07, -0.06]),
    box(m.darkMetal, [0.005, 0.026, 0.12], [0.023, 0.07, -0.06]),
    box(m.darkMetal, [0.051, 0.01, 0.12], [0, 0.088, -0.06]),
    ring(m.darkMetal, 0.0115, 0.0028, [0, sightY, 0.024]),
    box(m.darkMetal, [0.034, 0.01, 0.012], [0, sightY - 0.017, 0.024]),
    ...wingedFrontPost(m, -0.4, sightY, 0.05),
    charging,
    magazine,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0.014, -0.63]),
    ejectionPort: anchor([0.035, 0.03, 0.02]),
    sight: anchor([0, sightY, 0.022]),
    bolt: charging,
    magazine,
  });
}

function buildAK47(m: WeaponMaterials): WeaponModel {
  const sightY = 0.062;
  const charging = box(m.metal, [0.055, 0.02, 0.07], [0.024, 0.036, 0.04]);
  const magazine = curvedMagazine(m.polymer, 0.03, 0.06, [0, -0.03, -0.015], 3, 0.3);

  const parts: THREE.Object3D[] = [
    // Stamped receiver with the domed top cover.
    box(m.darkMetal, [0.048, 0.058, 0.25], [0, 0.002, -0.03]),
    box(m.darkMetal, [0.046, 0.022, 0.2], [0, 0.038, -0.04]),
    box(m.darkMetal, [0.05, 0.03, 0.07], [0, -0.02, -0.05]),
    // Wooden lower handguard and the gas tube above it.
    box(m.wood, [0.046, 0.042, 0.16], [0, -0.018, -0.24]),
    tube(m.wood, 0.021, 0.021, 0.13, [0, 0.042, -0.23], 8),
    tube(m.metal, 0.015, 0.015, 0.17, [0, 0.042, -0.28], 8),
    box(m.darkMetal, [0.03, 0.035, 0.03], [0, 0.038, -0.34]),
    // Barrel and the slanted brake.
    tube(m.metal, 0.0085, 0.0085, 0.3, [0, 0.002, -0.45]),
    tube(m.darkMetal, 0.014, 0.014, 0.05, [0, 0.002, -0.61], 8),
    box(m.darkMetal, [0.026, 0.03, 0.006], [0, 0.012, -0.632], [0.35, 0, 0]),
    // Wooden stock and grip.
    box(m.wood, [0.04, 0.058, 0.24], [0, -0.018, 0.21], [0.08, 0, 0]),
    box(m.wood, [0.044, 0.07, 0.025], [0, -0.035, 0.32]),
    ...gripAssembly(m, m.wood, 0.055, 0.34),
    // Safety lever: the long bar down the right side of the receiver.
    box(m.metal, [0.006, 0.05, 0.09], [0.027, 0.012, -0.02]),
    // Rear sight sits forward on the barrel trunnion, not on the receiver.
    ...notchRearSight(m, -0.15, sightY, 0.03, 0.014),
    ...hoodedFrontPost(m, -0.55, sightY, 0.022, 0.015, false),
    charging,
    magazine,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0.002, -0.645]),
    ejectionPort: anchor([0.036, 0.03, 0.01]),
    sight: anchor([0, sightY, -0.15]),
    bolt: charging,
    magazine,
  });
}

function buildM60(m: WeaponMaterials): WeaponModel {
  const sightY = 0.115;
  const charging = box(m.metal, [0.05, 0.026, 0.08], [0.03, 0.03, 0.02]);
  const beltBox = group(
    [
      box(m.polymer, [0.085, 0.1, 0.145], [0, -0.05, 0]),
      box(m.darkMetal, [0.09, 0.012, 0.15], [0, 0.004, 0]),
      // Belt of rounds climbing into the feed tray.
      box(m.metal, [0.03, 0.014, 0.05], [0, 0.014, 0.03], [0.5, 0, 0]),
      box(m.metal, [0.03, 0.014, 0.05], [0, 0.038, 0.055], [0.7, 0, 0]),
    ],
    [0, -0.05, -0.02],
  );

  const parts: THREE.Object3D[] = [
    // Big slab receiver with a hinged feed cover.
    box(m.darkMetal, [0.068, 0.085, 0.34], [0, 0.005, -0.06]),
    box(m.darkMetal, [0.07, 0.028, 0.22], [0, 0.06, -0.09]),
    box(m.darkMetal, [0.074, 0.014, 0.1], [0, 0.048, 0.02]),
    // Barrel, gas cylinder and the perforated shroud.
    tube(m.metal, 0.013, 0.013, 0.42, [0, 0.005, -0.46]),
    tube(m.darkMetal, 0.016, 0.016, 0.18, [0, -0.028, -0.36], 8),
    box(m.darkMetal, [0.046, 0.042, 0.15], [0, 0.03, -0.32]),
    tube(m.darkMetal, 0.021, 0.019, 0.07, [0, 0.005, -0.71], 8),
    // Barrel carry handle.
    box(m.metal, [0.012, 0.038, 0.012], [0, 0.06, -0.28]),
    box(m.metal, [0.012, 0.038, 0.012], [0, 0.06, -0.38]),
    box(m.rubber, [0.016, 0.014, 0.12], [0, 0.082, -0.33]),
    // Bipod, folded down under the gas system.
    box(m.metal, [0.01, 0.28, 0.01], [-0.06, -0.15, -0.52], [0, 0, 0.4]),
    box(m.metal, [0.01, 0.28, 0.01], [0.06, -0.15, -0.52], [0, 0, -0.4]),
    box(m.metal, [0.16, 0.008, 0.01], [0, -0.29, -0.52]),
    // Stock and grip.
    box(m.polymer, [0.05, 0.08, 0.22], [0, -0.01, 0.24], [0.05, 0, 0]),
    box(m.polymer, [0.055, 0.09, 0.025], [0, -0.02, 0.35]),
    ...gripAssembly(m, m.polymer, 0.06, 0.24, 0.11),
    // Leaf rear sight and the tall eared front blade.
    ...notchRearSight(m, 0.02, sightY, 0.078, 0.012),
    box(m.darkMetal, [0.042, 0.03, 0.008], [0, sightY + 0.014, 0.028]),
    ...earedFrontBlade(m, -0.44, sightY, 0.055),
    charging,
    beltBox,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0.005, -0.75]),
    ejectionPort: anchor([0.045, 0.01, 0.0]),
    sight: anchor([0, sightY, 0.02]),
    bolt: charging,
    magazine: beltBox,
  });
}

function buildL96(m: WeaponMaterials): WeaponModel {
  const scopeY = 0.108;
  const boltGroup = group([
    tube(m.metal, 0.012, 0.012, 0.12, [0.03, 0.026, 0.05], 8),
    box(m.metal, [0.05, 0.013, 0.013], [0.052, 0.026, 0.005]),
    ball(m.metal, 0.011, [0.078, 0.026, 0.005]),
  ]);
  const magazine = straightMagazine(m.darkMetal, 0.028, 0.075, 0.065, [0, -0.028, -0.04]);

  const parts: THREE.Object3D[] = [
    // Receiver and free floating barrel.
    box(m.darkMetal, [0.042, 0.052, 0.3], [0, 0.005, -0.07]),
    tube(m.metal, 0.011, 0.011, 0.52, [0, 0.005, -0.55]),
    tube(m.darkMetal, 0.019, 0.017, 0.08, [0, 0.005, -0.85], 8),
    box(m.darkMetal, [0.02, 0.01, 0.05], [0, 0.02, -0.85]),
    // Chassis stock: fore end, cheek piece, thumbhole and butt pad.
    box(m.polymer, [0.05, 0.055, 0.34], [0, -0.035, -0.33]),
    box(m.polymer, [0.048, 0.05, 0.16], [0, -0.03, 0.14]),
    box(m.polymer, [0.048, 0.055, 0.14], [0, 0.045, 0.25]),
    box(m.polymer, [0.048, 0.06, 0.04], [0, -0.02, 0.33]),
    box(m.rubber, [0.05, 0.1, 0.022], [0, 0.005, 0.36]),
    ...gripAssembly(m, m.polymer, 0.09, 0.22, 0.11),
    // Scope: rings, tube, elevation turret, ocular and objective bells.
    box(m.darkMetal, [0.02, 0.05, 0.022], [0, 0.06, -0.03]),
    box(m.darkMetal, [0.02, 0.05, 0.022], [0, 0.06, -0.24]),
    tube(m.darkMetal, 0.02, 0.02, 0.3, [0, scopeY, -0.14], 14),
    tube(m.darkMetal, 0.027, 0.027, 0.05, [0, scopeY, -0.31], 14),
    tube(m.darkMetal, 0.025, 0.025, 0.04, [0, scopeY, 0.02], 14),
    post(m.darkMetal, 0.012, 0.016, [0, scopeY + 0.026, -0.14]),
    post(m.darkMetal, 0.011, 0.014, [0.026, scopeY, -0.14]).rotateZ(Math.PI / 2),
    tube(m.glass, 0.026, 0.026, 0.005, [0, scopeY, -0.336], 14),
    tube(m.glass, 0.024, 0.024, 0.005, [0, scopeY, 0.039], 14),
    // Bipod.
    box(m.metal, [0.01, 0.24, 0.01], [-0.055, -0.16, -0.46], [0, 0, 0.36]),
    box(m.metal, [0.01, 0.24, 0.01], [0.055, -0.16, -0.46], [0, 0, -0.36]),
    boltGroup,
    magazine,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0.005, -0.9]),
    ejectionPort: anchor([0.035, 0.03, -0.02]),
    sight: anchor([0, scopeY, 0.02]),
    bolt: boltGroup,
    magazine,
  });
}

function buildMP5(m: WeaponMaterials): WeaponModel {
  const sightY = 0.068;
  // The cocking handle rides in a tube above the barrel: the MP5 signature.
  const charging = box(m.metal, [0.02, 0.016, 0.05], [-0.028, 0.045, -0.235]);
  const magazine = curvedMagazine(m.darkMetal, 0.026, 0.05, [0, -0.032, -0.06], 3, 0.16);

  const parts: THREE.Object3D[] = [
    box(m.darkMetal, [0.042, 0.052, 0.24], [0, 0.008, -0.05]),
    box(m.darkMetal, [0.046, 0.03, 0.09], [0, -0.024, -0.06]),
    // Cocking tube and its forward elbow.
    tube(m.darkMetal, 0.015, 0.015, 0.22, [0, 0.045, -0.2], 10),
    box(m.darkMetal, [0.022, 0.03, 0.03], [-0.02, 0.045, -0.24]),
    // Barrel inside a slim handguard.
    tube(m.polymer, 0.023, 0.023, 0.16, [0, 0.002, -0.19], 10),
    tube(m.metal, 0.008, 0.008, 0.14, [0, 0.002, -0.33]),
    tube(m.darkMetal, 0.012, 0.011, 0.03, [0, 0.002, -0.41], 8),
    // Fixed stock.
    box(m.polymer, [0.038, 0.05, 0.2], [0, 0.012, 0.19]),
    box(m.polymer, [0.042, 0.07, 0.022], [0, 0.004, 0.29]),
    ...gripAssembly(m, m.polymer, 0.045, 0.26),
    // HK rotary drum: an open barrel so the diopter is actually see through.
    hollowTube(m.darkMetal, 0.019, 0.026, [0, sightY, 0.03], 8),
    box(m.darkMetal, [0.03, 0.022, 0.016], [0, sightY - 0.026, 0.03]),
    ring(m.darkMetal, 0.0075, 0.0035, [0, sightY, 0.044]),
    // HK ring and post front sight.
    ...hoodedFrontPost(m, -0.36, sightY, 0.014, 0.016, true),
    charging,
    magazine,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0.002, -0.43]),
    ejectionPort: anchor([0.032, 0.028, -0.02]),
    sight: anchor([0, sightY, 0.045]),
    bolt: charging,
    magazine,
  });
}

function buildMP7(m: WeaponMaterials): WeaponModel {
  const sightY = 0.062;
  const charging = box(m.metal, [0.042, 0.014, 0.03], [0, 0.043, 0.055]);
  // The magazine feeds through the grip, which is what makes it read as an MP7.
  const magazine = straightMagazine(m.darkMetal, 0.024, 0.09, 0.042, [0, -0.048, 0.045], 0.22);

  const parts: THREE.Object3D[] = [
    box(m.polymer, [0.038, 0.048, 0.19], [0, 0.008, -0.03]),
    box(m.polymer, [0.042, 0.03, 0.08], [0, -0.02, 0.045]),
    box(m.darkMetal, [0.018, 0.008, 0.17], [0, 0.036, -0.04]),
    // Short barrel and shroud.
    tube(m.polymer, 0.018, 0.018, 0.09, [0, 0.002, -0.16], 8),
    tube(m.metal, 0.007, 0.007, 0.08, [0, 0.002, -0.24]),
    tube(m.darkMetal, 0.011, 0.01, 0.025, [0, 0.002, -0.29], 8),
    // Folding vertical foregrip, deployed.
    box(m.polymer, [0.022, 0.075, 0.028], [0, -0.05, -0.14], [0.12, 0, 0]),
    // Skeleton stock, extended.
    tube(m.metal, 0.008, 0.008, 0.16, [-0.016, 0.02, 0.16], 6),
    tube(m.metal, 0.008, 0.008, 0.16, [0.016, 0.02, 0.16], 6),
    box(m.polymer, [0.05, 0.055, 0.018], [0, 0.014, 0.24]),
    ...gripAssembly(m, m.polymer, 0.045, 0.18, 0.085),
    // Flip up ghost ring rear and a thin folding front post.
    box(m.darkMetal, [0.024, 0.022, 0.008], [0, sightY - 0.012, 0.05]),
    box(m.darkMetal, [0.004, 0.018, 0.006], [-0.009, sightY, 0.05]),
    box(m.darkMetal, [0.004, 0.018, 0.006], [0.009, sightY, 0.05]),
    box(m.darkMetal, [0.022, 0.004, 0.006], [0, sightY + 0.009, 0.05]),
    box(m.darkMetal, [0.018, 0.014, 0.008], [0, sightY - 0.018, -0.18]),
    box(m.darkMetal, [0.004, 0.026, 0.005], [0, sightY - 0.004, -0.18]),
    charging,
    magazine,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0.002, -0.305]),
    ejectionPort: anchor([0.028, 0.028, 0.01]),
    sight: anchor([0, sightY, 0.05]),
    bolt: charging,
    magazine,
  });
}

function buildUMP45(m: WeaponMaterials): WeaponModel {
  const sightY = 0.07;
  const charging = box(m.metal, [0.022, 0.016, 0.05], [-0.026, 0.04, -0.05]);
  // Fat, straight .45 stick magazine.
  const magazine = straightMagazine(m.polymer, 0.032, 0.115, 0.07, [0, -0.03, -0.05], 0.06);

  const parts: THREE.Object3D[] = [
    // Boxy polymer receiver.
    box(m.polymer, [0.05, 0.058, 0.26], [0, 0.006, -0.04]),
    box(m.polymer, [0.052, 0.032, 0.1], [0, -0.026, -0.05]),
    box(m.darkMetal, [0.02, 0.008, 0.2], [0, 0.038, -0.05]),
    // Handguard, barrel and a plain muzzle.
    box(m.polymer, [0.044, 0.04, 0.13], [0, -0.006, -0.22]),
    tube(m.metal, 0.0085, 0.0085, 0.12, [0, 0.002, -0.31]),
    tube(m.darkMetal, 0.013, 0.012, 0.022, [0, 0.002, -0.38], 8),
    // Side folding stock, extended.
    tube(m.darkMetal, 0.012, 0.012, 0.19, [0, 0.02, 0.19], 8),
    box(m.polymer, [0.046, 0.062, 0.02], [0, 0.016, 0.29]),
    ...gripAssembly(m, m.polymer, 0.05, 0.22, 0.095),
    // Open notch rear and a squared hood over the front post.
    ...notchRearSight(m, 0.05, sightY, 0.04, 0.012),
    ...hoodedFrontPost(m, -0.29, sightY, 0.02, 0.014, false),
    charging,
    magazine,
  ];

  return assemble(parts, {
    muzzle: anchor([0, 0.002, -0.395]),
    ejectionPort: anchor([0.034, 0.03, -0.03]),
    sight: anchor([0, sightY, 0.05]),
    bolt: charging,
    magazine,
  });
}

// ---------------------------------------------------------------------------

function assemble(
  parts: THREE.Object3D[],
  anchors: {
    muzzle: THREE.Object3D;
    ejectionPort: THREE.Object3D;
    sight: THREE.Object3D;
    bolt?: THREE.Object3D;
    magazine?: THREE.Object3D;
  },
): WeaponModel {
  const node = new THREE.Group();
  node.add(...parts, anchors.muzzle, anchors.ejectionPort, anchors.sight);
  return {
    group: node,
    muzzle: anchors.muzzle,
    ejectionPort: anchors.ejectionPort,
    sight: anchors.sight,
    bolt: anchors.bolt ?? null,
    magazine: anchors.magazine ?? null,
  };
}

const BUILDERS: Record<WeaponId, (materials: WeaponMaterials) => WeaponModel> = {
  m4a1: buildM4A1,
  ak47: buildAK47,
  m60: buildM60,
  l96: buildL96,
  mp5: buildMP5,
  mp7: buildMP7,
  ump45: buildUMP45,
};

export function createWeaponModel(id: WeaponId, materials: WeaponMaterials): WeaponModel {
  return BUILDERS[id](materials);
}
