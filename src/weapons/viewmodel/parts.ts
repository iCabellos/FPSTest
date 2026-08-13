import * as THREE from 'three';

/**
 * Shared vocabulary for building first person weapon models.
 *
 * Every weapon is laid out in the same local space: the bore line is Y = 0,
 * the muzzle points down −Z, and the receiver sits around the origin. Sights
 * are built on a shared sight line so aiming lines up automatically from the
 * model's own anchor.
 *
 * The sub assemblies below are the reason the models can carry real detail
 * without seventeen copies of the same fiddly maths. A rail knows how to space
 * its own slots, a trigger guard knows how to bend round a trigger, a magazine
 * knows how to curve. A builder describes *what* a weapon has, not how to
 * arrange forty boxes.
 */

export interface WeaponMaterials {
  metal: THREE.Material;
  darkMetal: THREE.Material;
  polymer: THREE.Material;
  wood: THREE.Material;
  rubber: THREE.Material;
  glass: THREE.Material;
  /** Bright brass, for cartridges and revolver cases. */
  brass: THREE.Material;
  /** Deep blued steel, for barrels and slides. */
  blued: THREE.Material;
  /** Desert tan polymer, so not every weapon is the same grey. */
  tan: THREE.Material;
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
    brass: new THREE.MeshPhongMaterial({ color: 0xc9a349, shininess: 95, specular: 0xffe08a }),
    blued: new THREE.MeshPhongMaterial({ color: 0x35393f, shininess: 90, specular: 0x6a7078 }),
    tan: new THREE.MeshPhongMaterial({ color: 0x9a8259, shininess: 14, specular: 0x2a2418 }),
  };
}

export function disposeWeaponMaterials(materials: WeaponMaterials): void {
  for (const material of Object.values(materials)) material.dispose();
}

export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function box(
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

/** Cylinder aligned with −Z, which is the weapon's forward axis. */
export function tube(
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  length: number,
  position: Vec3,
  segments = 12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  return mesh;
}

/** Open ended tube along −Z: you can see straight through it. */
export function hollowTube(
  material: THREE.Material,
  radius: number,
  length: number,
  position: Vec3,
  segments = 12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments, 1, true),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  return mesh;
}

/** Cylinder standing on the Y axis, for knobs, drums and pivots. */
export function post(
  material: THREE.Material,
  radius: number,
  length: number,
  position: Vec3,
  segments = 10,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  mesh.position.set(...position);
  return mesh;
}

/** Cylinder lying across the weapon on the X axis, for pins and cross bolts. */
export function pin(
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
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(...position);
  return mesh;
}

/** Ring lying in the XY plane, so it reads as a sight aperture from behind. */
export function ring(
  material: THREE.Material,
  radius: number,
  thickness: number,
  position: Vec3,
  segments = 16,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 6, segments), material);
  mesh.position.set(...position);
  return mesh;
}

/**
 * Partial ring in the YZ plane: the shape a trigger guard actually is, rather
 * than three boxes pretending.
 */
export function guardArc(
  material: THREE.Material,
  radius: number,
  thickness: number,
  position: Vec3,
  arc = Math.PI * 1.15,
  start = Math.PI * 0.95,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, thickness, 5, 14, arc),
    material,
  );
  mesh.rotation.y = Math.PI / 2;
  mesh.rotation.z = start;
  mesh.position.set(...position);
  return mesh;
}

export function ball(material: THREE.Material, radius: number, position: Vec3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
  mesh.position.set(...position);
  return mesh;
}

/** Rounded bar along −Z, for grips and forends that should not read as boxes. */
export function capsule(
  material: THREE.Material,
  radius: number,
  length: number,
  position: Vec3,
  rotation?: Vec3,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  return mesh;
}

/** Truncated cone along −Z, for flash hiders and cones. */
export function cone(
  material: THREE.Material,
  radiusFront: number,
  radiusBack: number,
  length: number,
  position: Vec3,
  segments = 12,
): THREE.Mesh {
  return tube(material, radiusFront, radiusBack, length, position, segments);
}

export function anchor(position: Vec3): THREE.Object3D {
  const object = new THREE.Object3D();
  object.position.set(...position);
  return object;
}

export function group(children: THREE.Object3D[], position: Vec3 = [0, 0, 0]): THREE.Group {
  const node = new THREE.Group();
  node.add(...children);
  node.position.set(...position);
  return node;
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

/**
 * Picatinny rail: a base with individually spaced slots, so it reads as a rail
 * from every angle instead of a smooth strip.
 */
export function rail(
  material: THREE.Material,
  options: { length: number; width?: number; position: Vec3; slotStep?: number },
): THREE.Group {
  const width = options.width ?? 0.02;
  const step = options.slotStep ?? 0.017;
  const parts: THREE.Object3D[] = [
    box(material, [width, 0.006, options.length], [0, 0, 0]),
    box(material, [width * 0.55, 0.008, options.length], [0, 0.006, 0]),
  ];
  const slots = Math.max(1, Math.floor(options.length / step));
  const first = -options.length / 2 + step / 2;
  for (let i = 0; i < slots; i++) {
    parts.push(box(material, [width, 0.007, 0.006], [0, 0.005, first + i * step]));
  }
  return group(parts, options.position);
}

/**
 * Barrel with a taper and a chamber shoulder. `profile` sets how much thicker
 * the chamber end is, which is most of what tells a carbine from a rifle.
 */
export function barrel(
  material: THREE.Material,
  options: { radius: number; length: number; z: number; y?: number; profile?: number },
): THREE.Group {
  const y = options.y ?? 0;
  const chamber = options.radius * (options.profile ?? 1.45);
  return group([
    tube(material, options.radius, options.radius * 1.06, options.length, [0, y, options.z]),
    tube(material, chamber, chamber, options.length * 0.22, [
      0,
      y,
      options.z + options.length * 0.42,
    ]),
  ]);
}

export type MuzzleStyle = 'flash' | 'brake' | 'compensator' | 'plain' | 'shroud' | 'crown';

/** The device on the end of the barrel. Reads instantly at the muzzle. */
export function muzzleDevice(
  materials: WeaponMaterials,
  style: MuzzleStyle,
  options: { radius: number; z: number; y?: number },
): THREE.Group {
  const y = options.y ?? 0;
  const r = options.radius;
  const parts: THREE.Object3D[] = [];

  switch (style) {
    case 'flash':
      // Birdcage: a slotted cylinder with a stepped collar behind it.
      parts.push(hollowTube(materials.darkMetal, r * 1.5, 0.05, [0, y, 0]));
      parts.push(tube(materials.darkMetal, r * 1.6, r * 1.6, 0.012, [0, y, 0.028]));
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        parts.push(
          box(
            materials.darkMetal,
            [0.004, r * 0.9, 0.03],
            [Math.cos(angle) * r * 1.4, y + Math.sin(angle) * r * 1.4, -0.006],
            [0, 0, angle],
          ),
        );
      }
      break;
    case 'brake':
      // Squared brake with side ports.
      parts.push(box(materials.darkMetal, [r * 3, r * 2.6, 0.06], [0, y, 0]));
      for (const side of [-1, 1]) {
        for (const z of [-0.012, 0.008]) {
          parts.push(box(materials.rubber, [r * 3.2, r * 1.5, 0.012], [side * r * 0.2, y, z]));
        }
      }
      parts.push(hollowTube(materials.darkMetal, r * 0.9, 0.07, [0, y, 0]));
      break;
    case 'compensator':
      parts.push(tube(materials.darkMetal, r * 1.35, r * 1.5, 0.055, [0, y, 0]));
      for (let i = 0; i < 3; i++) {
        parts.push(box(materials.rubber, [r * 3, 0.005, 0.01], [0, y + r * 1.1, -0.014 + i * 0.014]));
      }
      break;
    case 'shroud':
      // Perforated jacket over the barrel, seen on old machine guns.
      parts.push(hollowTube(materials.darkMetal, r * 1.9, 0.13, [0, y, 0.02]));
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        parts.push(
          post(materials.rubber, r * 0.32, 0.006, [
            Math.cos(angle) * r * 1.9,
            y + Math.sin(angle) * r * 1.9,
            0.02,
          ]),
        );
      }
      break;
    case 'crown':
      // A plain crowned muzzle: a slight step, nothing more.
      parts.push(tube(materials.blued, r * 1.12, r * 1.12, 0.014, [0, y, 0]));
      parts.push(hollowTube(materials.rubber, r * 0.62, 0.02, [0, y, -0.002]));
      break;
    default:
      parts.push(tube(materials.darkMetal, r * 1.2, r * 1.2, 0.026, [0, y, 0]));
      parts.push(hollowTube(materials.rubber, r * 0.7, 0.03, [0, y, -0.002]));
      break;
  }
  return group(parts, [0, 0, options.z]);
}

/** Gas block with a tube running back to the receiver. */
export function gasSystem(
  materials: WeaponMaterials,
  options: { z: number; radius: number; tubeLength: number; y?: number },
): THREE.Group {
  const y = options.y ?? 0;
  return group([
    box(materials.darkMetal, [options.radius * 2.2, options.radius * 2.6, 0.05], [0, y + 0.004, 0]),
    tube(materials.metal, options.radius * 0.36, options.radius * 0.36, options.tubeLength, [
      0,
      y + options.radius * 1.5,
      options.tubeLength / 2 + 0.02,
    ]),
  ]);
}

/**
 * Handguard. `vents` cuts real holes in the sides rather than painting them,
 * and `rails` adds a top rail plus short side stubs.
 */
export function handguard(
  materials: WeaponMaterials,
  options: {
    material?: THREE.Material;
    length: number;
    radius: number;
    z: number;
    y?: number;
    style?: 'round' | 'quad' | 'ribbed';
    vents?: number;
  },
): THREE.Group {
  const y = options.y ?? 0;
  const material = options.material ?? materials.polymer;
  const parts: THREE.Object3D[] = [];
  const style = options.style ?? 'round';

  if (style === 'quad') {
    parts.push(box(material, [options.radius * 2, options.radius * 2, options.length], [0, y, 0]));
    for (const [rx, ry, rz] of [
      [0, options.radius, 0],
      [0, -options.radius, 0],
      [options.radius, 0, Math.PI / 2],
      [-options.radius, 0, Math.PI / 2],
    ] as const) {
      const strip = rail(materials.darkMetal, {
        length: options.length * 0.94,
        width: options.radius * 1.1,
        position: [rx, y + ry, 0],
      });
      strip.rotation.z = rz;
      parts.push(strip);
    }
  } else {
    parts.push(hollowTube(material, options.radius, options.length, [0, y, 0], 14));
    parts.push(tube(material, options.radius, options.radius, 0.012, [0, y, options.length / 2]));
    parts.push(tube(material, options.radius, options.radius, 0.012, [0, y, -options.length / 2]));
  }

  if (style === 'ribbed') {
    const ribs = 6;
    for (let i = 0; i < ribs; i++) {
      const z = -options.length / 2 + (options.length / ribs) * (i + 0.5);
      parts.push(tube(material, options.radius * 1.08, options.radius * 1.08, 0.008, [0, y, z]));
    }
  }

  // Cooling vents, as through holes down both sides.
  const vents = options.vents ?? 0;
  for (let i = 0; i < vents; i++) {
    const z = -options.length / 2 + (options.length / (vents + 1)) * (i + 1);
    for (const side of [-1, 1]) {
      parts.push(
        pin(materials.rubber, options.radius * 0.24, options.radius * 2.3, [side * 0, y, z]),
      );
    }
  }

  return group(parts, [0, 0, options.z]);
}

/** Pistol grip with checkering ribs and a beavertail. */
export function pistolGrip(
  materials: WeaponMaterials,
  options: {
    material?: THREE.Material;
    z: number;
    angle: number;
    length?: number;
    width?: number;
    beavertail?: boolean;
  },
): THREE.Group {
  const material = options.material ?? materials.polymer;
  const length = options.length ?? 0.1;
  const width = options.width ?? 0.036;
  const parts: THREE.Object3D[] = [
    box(material, [width, length, 0.048], [0, -length / 2 - 0.028, 0], [options.angle, 0, 0]),
    // Palm swell and butt cap.
    box(material, [width * 1.06, 0.016, 0.05], [0, -length - 0.024, length * options.angle * 0.9]),
  ];
  // Checkering: shallow ribs up the back strap.
  for (let i = 0; i < 5; i++) {
    const t = 0.2 + i * 0.15;
    parts.push(
      box(
        materials.rubber,
        [width * 1.02, 0.006, 0.008],
        [0, -0.03 - length * t, 0.022 + length * t * options.angle],
        [options.angle, 0, 0],
      ),
    );
  }
  if (options.beavertail) {
    parts.push(box(material, [width * 0.9, 0.012, 0.036], [0, -0.012, 0.03], [0.4, 0, 0]));
  }
  return group(parts, [0, 0, options.z]);
}

/** Trigger, and a guard that is actually curved around it. */
export function triggerGroup(
  materials: WeaponMaterials,
  options: { z: number; y?: number; radius?: number },
): THREE.Group {
  const y = options.y ?? -0.03;
  const radius = options.radius ?? 0.026;
  return group(
    [
      guardArc(materials.darkMetal, radius, 0.004, [0, y - radius * 0.55, -0.018]),
      box(materials.darkMetal, [0.012, 0.01, 0.05], [0, y + 0.006, -0.01]),
      // The trigger blade itself, raked back.
      box(materials.metal, [0.007, 0.026, 0.008], [0, y - 0.012, -0.018], [0.24, 0, 0]),
    ],
    [0, 0, options.z],
  );
}

export type StockStyle = 'fixed' | 'collapsible' | 'folding' | 'skeleton' | 'thumbhole' | 'wire';

/** Shoulder stock. The silhouette behind the grip is most of a weapon's read. */
export function stock(
  materials: WeaponMaterials,
  style: StockStyle,
  options: { material?: THREE.Material; z: number; length: number; y?: number },
): THREE.Group {
  const material = options.material ?? materials.polymer;
  const y = options.y ?? 0;
  const l = options.length;
  const parts: THREE.Object3D[] = [];

  switch (style) {
    case 'collapsible':
      // Buffer tube with a sliding carrier and a rubber pad.
      parts.push(tube(materials.darkMetal, 0.017, 0.017, l, [0, y + 0.005, l / 2]));
      parts.push(box(material, [0.044, 0.062, l * 0.42], [0, y - 0.004, l * 0.72]));
      parts.push(box(material, [0.05, 0.075, 0.016], [0, y - 0.006, l * 0.96]));
      parts.push(box(materials.rubber, [0.046, 0.07, 0.01], [0, y - 0.006, l * 1.0]));
      // Adjustment notches along the underside.
      for (let i = 0; i < 4; i++) {
        parts.push(box(materials.darkMetal, [0.02, 0.006, 0.008], [0, y - 0.014, l * (0.3 + i * 0.12)]));
      }
      break;
    case 'folding':
      parts.push(tube(materials.darkMetal, 0.011, 0.011, l * 0.9, [0.02, y + 0.018, l * 0.45]));
      parts.push(tube(materials.darkMetal, 0.011, 0.011, l * 0.9, [-0.02, y + 0.018, l * 0.45]));
      parts.push(box(material, [0.062, 0.05, 0.022], [0, y + 0.014, l * 0.92]));
      parts.push(box(materials.darkMetal, [0.05, 0.05, 0.02], [0, y + 0.01, 0.012]));
      break;
    case 'skeleton':
      parts.push(box(material, [0.03, 0.018, l], [0, y + 0.03, l / 2]));
      parts.push(box(material, [0.03, 0.016, l * 0.8], [0, y - 0.035, l * 0.42]));
      parts.push(box(material, [0.03, 0.09, 0.018], [0, y - 0.004, l * 0.98]));
      parts.push(box(materials.rubber, [0.032, 0.086, 0.01], [0, y - 0.004, l * 1.02]));
      break;
    case 'thumbhole':
      parts.push(box(material, [0.042, 0.075, l], [0, y - 0.012, l / 2]));
      // The hole itself, cut as a gap between two struts.
      parts.push(box(materials.rubber, [0.05, 0.036, 0.052], [0, y - 0.012, l * 0.34]));
      parts.push(box(material, [0.046, 0.1, 0.02], [0, y - 0.014, l * 0.97]));
      parts.push(box(materials.rubber, [0.048, 0.096, 0.012], [0, y - 0.014, l * 1.01]));
      break;
    case 'wire':
      for (const side of [-1, 1]) {
        parts.push(tube(materials.darkMetal, 0.0075, 0.0075, l, [side * 0.026, y + 0.01, l / 2]));
      }
      parts.push(pin(materials.darkMetal, 0.0075, 0.052, [0, y + 0.01, l]));
      parts.push(box(materials.rubber, [0.05, 0.03, 0.012], [0, y + 0.01, l * 1.01]));
      break;
    default:
      parts.push(box(material, [0.044, 0.08, l], [0, y - 0.014, l / 2], [-0.05, 0, 0]));
      parts.push(box(material, [0.046, 0.098, 0.018], [0, y - 0.026, l * 0.98]));
      parts.push(box(materials.rubber, [0.048, 0.094, 0.012], [0, y - 0.028, l * 1.02]));
      // Comb, so the cheek weld reads.
      parts.push(box(material, [0.03, 0.014, l * 0.6], [0, y + 0.026, l * 0.5], [-0.05, 0, 0]));
      break;
  }
  return group(parts, [0, 0, options.z]);
}

export type MagazineStyle = 'straight' | 'curved' | 'drum' | 'stick' | 'tube';

/**
 * Detachable magazine, built as its own group so the reload animation can drop
 * it away. Always returned with its top at the origin, so the caller positions
 * it by the magazine well and nothing else has to know its length.
 */
export function magazine(
  materials: WeaponMaterials,
  style: MagazineStyle,
  options: {
    material?: THREE.Material;
    position: Vec3;
    width?: number;
    depth?: number;
    height?: number;
    curve?: number;
  },
): THREE.Group {
  const material = options.material ?? materials.darkMetal;
  const width = options.width ?? 0.03;
  const depth = options.depth ?? 0.06;
  const height = options.height ?? 0.1;
  const parts: THREE.Object3D[] = [];

  if (style === 'drum') {
    parts.push(post(material, height * 0.52, width, [0, -height * 0.55, 0], 20));
    parts.push(post(materials.metal, height * 0.2, width * 1.15, [0, -height * 0.55, 0], 14));
    parts.push(box(material, [width, height * 0.34, depth * 0.6], [0, -height * 0.16, 0]));
    // Wind ribs, so the drum is not a plain disc.
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      parts.push(
        box(
          materials.metal,
          [width * 1.04, height * 0.4, 0.006],
          [0, -height * 0.55 + Math.sin(angle) * height * 0.28, Math.cos(angle) * height * 0.28],
          [angle, 0, 0],
        ),
      );
    }
  } else if (style === 'curved') {
    // Stacked segments, each tilted a little further back.
    const segments = 4;
    const curve = options.curve ?? 0.22;
    let y = 0;
    let z = 0;
    for (let i = 0; i < segments; i++) {
      const segment = height / segments;
      const tilt = -curve * i;
      y -= segment * 0.88;
      z -= Math.sin(curve * i) * segment * 0.95;
      parts.push(box(material, [width, segment, depth], [0, y, z], [tilt, 0, 0]));
      parts.push(box(materials.rubber, [width * 1.03, 0.004, depth * 0.9], [0, y, z], [tilt, 0, 0]));
    }
    parts.push(box(material, [width * 1.08, 0.012, depth * 1.02], [0, y - height / segments / 2, z]));
  } else if (style === 'tube') {
    parts.push(tube(material, width * 0.5, width * 0.5, depth, [0, 0, 0]));
    parts.push(tube(materials.metal, width * 0.56, width * 0.56, 0.012, [0, 0, -depth / 2]));
  } else {
    const slim = style === 'stick';
    const w = slim ? width * 0.78 : width;
    parts.push(box(material, [w, height, depth], [0, -height / 2, 0]));
    parts.push(box(material, [w * 1.08, 0.012, depth * 1.05], [0, -height + 0.006, 0]));
    // Witness holes down the spine.
    for (let i = 0; i < 3; i++) {
      parts.push(
        post(materials.rubber, w * 0.14, depth * 1.02, [0, -height * (0.28 + i * 0.22), 0], 6),
      );
    }
  }

  return group(parts, options.position);
}

/** Charging handle. Which side it is on is part of a weapon's identity. */
export function chargingHandle(
  materials: WeaponMaterials,
  style: 'side' | 'top' | 'rear' | 'tube',
  options: { z: number; y?: number; x?: number },
): THREE.Group {
  const y = options.y ?? 0.03;
  const x = options.x ?? 0.026;
  switch (style) {
    case 'top':
      return group([
        box(materials.metal, [0.03, 0.014, 0.05], [0, y, 0]),
        box(materials.darkMetal, [0.014, 0.02, 0.02], [0, y + 0.014, 0.014]),
      ]);
    case 'rear':
      return group([
        box(materials.metal, [0.05, 0.012, 0.03], [0, y, 0]),
        box(materials.darkMetal, [0.02, 0.016, 0.014], [0, y + 0.008, 0.012]),
      ]);
    case 'tube':
      return group([
        tube(materials.metal, 0.012, 0.012, 0.09, [x, y, 0]),
        ball(materials.darkMetal, 0.016, [x, y, -0.05]),
      ]);
    default:
      return group([
        box(materials.metal, [0.026, 0.016, 0.052], [x, y, 0]),
        box(materials.darkMetal, [0.016, 0.024, 0.018], [x + 0.012, y, 0.016]),
      ]);
  }
}

/** Safety or fire selector lever on the side of the receiver. */
export function selector(
  materials: WeaponMaterials,
  options: { z: number; y?: number; x?: number; long?: boolean },
): THREE.Group {
  const y = options.y ?? 0.006;
  const x = options.x ?? 0.024;
  const length = options.long ? 0.06 : 0.024;
  return group([
    post(materials.darkMetal, 0.009, 0.006, [x, y, 0], 8).rotateZ(Math.PI / 2),
    box(materials.metal, [0.006, 0.012, length], [x + 0.005, y, -length * 0.3]),
  ]);
}

/**
 * Recessed ejection port with a dust cover lip, on the right hand side. Gives
 * the receiver somewhere for brass to plausibly come from.
 */
export function ejectionPortCut(
  materials: WeaponMaterials,
  options: { z: number; y?: number; x?: number; length?: number },
): THREE.Group {
  const y = options.y ?? 0.014;
  const x = options.x ?? 0.023;
  const length = options.length ?? 0.058;
  return group([
    box(materials.rubber, [0.006, 0.03, length], [x, y, 0]),
    box(materials.darkMetal, [0.008, 0.008, length * 1.1], [x + 0.002, y - 0.02, 0]),
    box(materials.darkMetal, [0.008, 0.006, length * 1.1], [x + 0.002, y + 0.017, 0]),
  ]);
}

/** Sling loop, hung under or beside the furniture. */
export function slingLoop(materials: WeaponMaterials, position: Vec3): THREE.Mesh {
  const loop = ring(materials.darkMetal, 0.011, 0.0028, position, 10);
  loop.rotation.y = Math.PI / 2;
  return loop;
}

// ---------------------------------------------------------------------------
// Sights
// ---------------------------------------------------------------------------

/** Front post standing on the sight line, with side protection. */
export function wingedFrontPost(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  baseY: number,
): THREE.Object3D[] {
  const height = sightY - baseY + 0.012;
  return [
    box(m.darkMetal, [0.026, 0.014, 0.03], [0, baseY, z]),
    box(m.darkMetal, [0.005, height, 0.006], [0, baseY + height / 2, z]),
    box(m.darkMetal, [0.004, height * 0.9, 0.02], [-0.013, baseY + height / 2, z]),
    box(m.darkMetal, [0.004, height * 0.9, 0.02], [0.013, baseY + height / 2, z]),
  ];
}

/** Post inside a full hood: the HK and AK style front sight. */
export function hoodedFrontPost(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  baseY: number,
  radius: number,
  full: boolean,
): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [
    box(m.darkMetal, [0.028, 0.016, 0.032], [0, baseY, z]),
    box(m.metal, [0.004, sightY - baseY, 0.005], [0, baseY + (sightY - baseY) / 2, z]),
  ];
  const hood = full
    ? hollowTube(m.darkMetal, radius, 0.034, [0, sightY - radius * 0.1, z], 12)
    : ring(m.darkMetal, radius, 0.0035, [0, sightY - radius * 0.1, z], 12);
  parts.push(hood);
  return parts;
}

/** Blade between two protective ears, the machine gun front sight. */
export function earedFrontBlade(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  baseY: number,
): THREE.Object3D[] {
  const height = sightY - baseY;
  return [
    box(m.darkMetal, [0.036, 0.014, 0.034], [0, baseY, z]),
    box(m.metal, [0.005, height, 0.005], [0, baseY + height / 2, z]),
    box(m.darkMetal, [0.005, height * 1.25, 0.016], [-0.016, baseY + height * 0.62, z]),
    box(m.darkMetal, [0.005, height * 1.25, 0.016], [0.016, baseY + height * 0.62, z]),
  ];
}

/** Open notch rear sight, sitting on a base. */
export function notchRearSight(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  baseY: number,
  gap: number,
): THREE.Object3D[] {
  const height = sightY - baseY;
  return [
    box(m.darkMetal, [0.03, 0.01, 0.028], [0, baseY, z]),
    box(m.darkMetal, [(0.03 - gap) / 2, height, 0.008], [-(gap + (0.03 - gap) / 2) / 2, baseY + height / 2, z]),
    box(m.darkMetal, [(0.03 - gap) / 2, height, 0.008], [(gap + (0.03 - gap) / 2) / 2, baseY + height / 2, z]),
  ];
}

/** Aperture rear: a ring you look through, on a raised base. */
export function apertureRearSight(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  baseY: number,
  radius: number,
): THREE.Object3D[] {
  return [
    box(m.darkMetal, [0.03, sightY - baseY, 0.022], [0, baseY + (sightY - baseY) / 2, z]),
    ring(m.darkMetal, radius, 0.0045, [0, sightY, z], 14),
    // Windage drum on the side.
    post(m.metal, 0.008, 0.008, [0.018, sightY - 0.004, z], 8).rotateZ(Math.PI / 2),
  ];
}

/** Rotary drum rear, the HK signature. Open ended so the sight line is clear. */
export function drumRearSight(
  m: WeaponMaterials,
  z: number,
  sightY: number,
  radius: number,
): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [
    hollowTube(m.darkMetal, radius, 0.026, [0, sightY - radius * 0.2, z], 12),
    box(m.darkMetal, [0.03, 0.014, 0.02], [0, sightY - radius - 0.008, z]),
  ];
  // Setting marks around the drum.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    parts.push(
      box(
        m.metal,
        [0.004, radius * 0.5, 0.028],
        [Math.cos(angle) * radius * 0.75, sightY - radius * 0.2 + Math.sin(angle) * radius * 0.75, z],
        [0, 0, angle],
      ),
    );
  }
  return parts;
}

/** Telescopic sight with mounts, an objective bell and a bright lens. */
export function scope(
  m: WeaponMaterials,
  options: { z: number; sightY: number; length?: number; radius?: number },
): THREE.Object3D[] {
  const length = options.length ?? 0.3;
  const radius = options.radius ?? 0.022;
  const y = options.sightY;
  return [
    tube(m.darkMetal, radius, radius, length, [0, y, options.z]),
    // Objective bell and ocular.
    tube(m.darkMetal, radius * 1.35, radius * 1.1, 0.055, [0, y, options.z - length / 2 - 0.02]),
    tube(m.darkMetal, radius * 1.2, radius * 1.05, 0.04, [0, y, options.z + length / 2 + 0.015]),
    // Turret housing and the two drums.
    box(m.darkMetal, [radius * 1.9, radius * 1.9, 0.05], [0, y, options.z + 0.02]),
    post(m.metal, 0.012, 0.016, [0, y + radius * 1.5, options.z + 0.02], 10),
    post(m.metal, 0.012, 0.016, [radius * 1.5, y, options.z + 0.02], 10).rotateZ(Math.PI / 2),
    // Glass at both ends.
    tube(m.glass, radius * 1.2, radius * 1.2, 0.005, [0, y, options.z - length / 2 - 0.046]),
    tube(m.glass, radius * 0.95, radius * 0.95, 0.005, [0, y, options.z + length / 2 + 0.033]),
    // Two ring mounts.
    box(m.metal, [radius * 1.8, radius * 1.6, 0.018], [0, y - radius * 0.9, options.z - length * 0.3]),
    box(m.metal, [radius * 1.8, radius * 1.6, 0.018], [0, y - radius * 0.9, options.z + length * 0.3]),
  ];
}

/** Simple bead on a ramp: the shotgun front sight. */
export function beadFrontSight(m: WeaponMaterials, z: number, sightY: number, baseY: number): THREE.Object3D[] {
  return [
    box(m.darkMetal, [0.014, sightY - baseY, 0.022], [0, baseY + (sightY - baseY) / 2, z], [0.2, 0, 0]),
    ball(m.brass, 0.006, [0, sightY, z]),
  ];
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

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

export function assemble(
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
