import * as THREE from 'three';
import type { WeaponId } from '../WeaponDefinition';

/**
 * Placeholder first person models built from primitives. They are readable
 * silhouettes rather than art assets; swapping in a GLB only requires
 * returning the same anchors from {@link createWeaponModel}.
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
  magazine: THREE.Object3D | null;
}

export interface WeaponMaterials {
  metal: THREE.Material;
  darkMetal: THREE.Material;
  polymer: THREE.Material;
  wood: THREE.Material;
  glass: THREE.Material;
}

export function createWeaponMaterials(): WeaponMaterials {
  return {
    metal: new THREE.MeshPhongMaterial({ color: 0x8d939b, shininess: 70, specular: 0x4a4f55 }),
    darkMetal: new THREE.MeshPhongMaterial({ color: 0x4b5057, shininess: 45, specular: 0x33373c }),
    polymer: new THREE.MeshPhongMaterial({ color: 0x565a52, shininess: 16, specular: 0x1d1f19 }),
    wood: new THREE.MeshPhongMaterial({ color: 0x8f5b2c, shininess: 24, specular: 0x33200f }),
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

function box(
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
  rotation?: [number, number, number],
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
  position: [number, number, number],
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

/** Aperture sight ring. The hole is what makes ADS readable. */
function ring(
  material: THREE.Material,
  radius: number,
  tube: number,
  position: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 5, 12), material);
  mesh.position.set(...position);
  return mesh;
}

function anchor(position: [number, number, number]): THREE.Object3D {
  const object = new THREE.Object3D();
  object.position.set(...position);
  return object;
}

function assemble(
  parts: THREE.Object3D[],
  anchors: { muzzle: THREE.Object3D; ejectionPort: THREE.Object3D; sight: THREE.Object3D },
  extras: { bolt?: THREE.Object3D; magazine?: THREE.Object3D } = {},
): WeaponModel {
  const group = new THREE.Group();
  group.add(...parts, anchors.muzzle, anchors.ejectionPort, anchors.sight);
  return {
    group,
    muzzle: anchors.muzzle,
    ejectionPort: anchors.ejectionPort,
    sight: anchors.sight,
    bolt: extras.bolt ?? null,
    magazine: extras.magazine ?? null,
  };
}

function buildM4A1(m: WeaponMaterials): WeaponModel {
  const bolt = box(m.metal, [0.052, 0.026, 0.07], [0.014, 0.045, 0.055]);
  const magazine = box(m.polymer, [0.032, 0.17, 0.062], [0, -0.13, -0.015], [-0.12, 0, 0]);

  const parts = [
    box(m.darkMetal, [0.058, 0.072, 0.33], [0, 0.008, -0.06]),
    box(m.polymer, [0.05, 0.062, 0.1], [0, -0.05, 0.015]),
    box(m.polymer, [0.056, 0.056, 0.23], [0, 0.002, -0.33]),
    box(m.darkMetal, [0.022, 0.012, 0.42], [0, 0.049, -0.18]),
    tube(m.metal, 0.011, 0.011, 0.18, [0, 0.006, -0.53]),
    tube(m.darkMetal, 0.017, 0.014, 0.055, [0, 0.006, -0.63], 8),
    box(m.polymer, [0.046, 0.068, 0.17], [0, -0.008, 0.21]),
    tube(m.darkMetal, 0.019, 0.019, 0.1, [0, -0.005, 0.14], 8),
    box(m.polymer, [0.038, 0.105, 0.05], [0, -0.085, 0.075], [0.28, 0, 0]),
    box(m.darkMetal, [0.006, 0.028, 0.008], [0, 0.068, -0.44]),
    box(m.darkMetal, [0.026, 0.03, 0.012], [0, 0.05, -0.44]),
    ring(m.darkMetal, 0.011, 0.0032, [0, 0.072, 0.02]),
    box(m.darkMetal, [0.028, 0.014, 0.012], [0, 0.056, 0.02]),
    bolt,
    magazine,
  ];

  return assemble(
    parts,
    {
      muzzle: anchor([0, 0.006, -0.665]),
      ejectionPort: anchor([0.04, 0.04, 0.03]),
      sight: anchor([0, 0.072, 0.02]),
    },
    { bolt, magazine },
  );
}

function buildAK47(m: WeaponMaterials): WeaponModel {
  const bolt = box(m.metal, [0.05, 0.028, 0.075], [0.016, 0.043, 0.04]);
  const magazine = new THREE.Group();
  magazine.add(
    box(m.polymer, [0.032, 0.1, 0.06], [0, -0.075, -0.01], [-0.24, 0, 0]),
    box(m.polymer, [0.032, 0.085, 0.055], [0, -0.15, -0.045], [-0.62, 0, 0]),
  );
  magazine.position.set(0, -0.02, 0);

  const parts = [
    box(m.darkMetal, [0.056, 0.074, 0.3], [0, 0.004, -0.04]),
    box(m.wood, [0.058, 0.06, 0.19], [0, -0.004, -0.29]),
    tube(m.metal, 0.014, 0.014, 0.2, [0, 0.042, -0.28], 8),
    tube(m.metal, 0.011, 0.011, 0.3, [0, 0.004, -0.5]),
    tube(m.darkMetal, 0.018, 0.016, 0.06, [0, 0.004, -0.66], 8),
    box(m.darkMetal, [0.006, 0.03, 0.008], [0, 0.07, -0.6]),
    box(m.darkMetal, [0.022, 0.03, 0.026], [0, 0.05, -0.6]),
    box(m.wood, [0.048, 0.075, 0.22], [0, -0.02, 0.22], [0.06, 0, 0]),
    box(m.wood, [0.04, 0.11, 0.052], [0, -0.09, 0.08], [0.3, 0, 0]),
    ring(m.darkMetal, 0.011, 0.0032, [0, 0.074, 0.05]),
    box(m.darkMetal, [0.028, 0.016, 0.014], [0, 0.058, 0.05]),
    bolt,
    magazine,
  ];

  return assemble(
    parts,
    {
      muzzle: anchor([0, 0.004, -0.7]),
      ejectionPort: anchor([0.042, 0.04, 0.02]),
      sight: anchor([0, 0.074, 0.05]),
    },
    { bolt, magazine },
  );
}

function buildM60(m: WeaponMaterials): WeaponModel {
  const bolt = box(m.metal, [0.05, 0.03, 0.09], [0.026, 0.04, 0.03]);
  const beltBox = box(m.polymer, [0.09, 0.11, 0.16], [0, -0.11, -0.02]);

  const parts = [
    box(m.darkMetal, [0.075, 0.1, 0.4], [0, 0.005, -0.08]),
    box(m.darkMetal, [0.06, 0.05, 0.26], [0, 0.06, -0.36]),
    tube(m.metal, 0.016, 0.016, 0.44, [0, 0.005, -0.5]),
    tube(m.darkMetal, 0.024, 0.02, 0.07, [0, 0.005, -0.75], 8),
    box(m.metal, [0.016, 0.055, 0.13], [0, 0.075, -0.4]),
    box(m.polymer, [0.06, 0.09, 0.24], [0, -0.02, 0.27], [0.04, 0, 0]),
    box(m.polymer, [0.044, 0.12, 0.055], [0, -0.1, 0.1], [0.24, 0, 0]),
    ring(m.darkMetal, 0.012, 0.0034, [0, 0.105, 0.03]),
    box(m.darkMetal, [0.03, 0.03, 0.014], [0, 0.08, 0.03]),
    box(m.darkMetal, [0.007, 0.034, 0.01], [0, 0.1, -0.5]),
    box(m.darkMetal, [0.024, 0.03, 0.018], [0, 0.076, -0.5]),
    // Bipod legs folded down under the barrel.
    box(m.metal, [0.012, 0.3, 0.012], [-0.07, -0.14, -0.6], [0, 0, 0.42]),
    box(m.metal, [0.012, 0.3, 0.012], [0.07, -0.14, -0.6], [0, 0, -0.42]),
    bolt,
    beltBox,
  ];

  return assemble(
    parts,
    {
      muzzle: anchor([0, 0.005, -0.79]),
      ejectionPort: anchor([0.055, 0.03, 0.02]),
      sight: anchor([0, 0.105, 0.03]),
    },
    { bolt, magazine: beltBox },
  );
}

function buildL96(m: WeaponMaterials): WeaponModel {
  const boltGroup = new THREE.Group();
  boltGroup.add(
    tube(m.metal, 0.013, 0.013, 0.13, [0.032, 0.03, 0.06], 8),
    box(m.metal, [0.05, 0.014, 0.014], [0.055, 0.03, 0.02]),
  );
  const magazine = box(m.darkMetal, [0.03, 0.09, 0.07], [0, -0.085, -0.04]);

  const scopeTube = tube(m.darkMetal, 0.024, 0.024, 0.32, [0, 0.105, -0.16], 12);
  const lens = tube(m.glass, 0.023, 0.023, 0.006, [0, 0.105, -0.322], 12);

  const parts = [
    box(m.darkMetal, [0.05, 0.07, 0.36], [0, 0.005, -0.08]),
    box(m.polymer, [0.055, 0.11, 0.3], [0, -0.03, 0.2], [0.03, 0, 0]),
    box(m.polymer, [0.05, 0.06, 0.16], [0, 0.05, 0.24]),
    box(m.polymer, [0.042, 0.115, 0.055], [0, -0.09, 0.07], [0.26, 0, 0]),
    box(m.polymer, [0.05, 0.05, 0.3], [0, -0.02, -0.34]),
    tube(m.metal, 0.012, 0.012, 0.5, [0, 0.005, -0.6]),
    tube(m.darkMetal, 0.021, 0.019, 0.09, [0, 0.005, -0.88], 8),
    box(m.darkMetal, [0.02, 0.045, 0.06], [0, 0.05, -0.06]),
    box(m.darkMetal, [0.02, 0.045, 0.06], [0, 0.05, -0.27]),
    scopeTube,
    lens,
    box(m.metal, [0.012, 0.26, 0.012], [-0.06, -0.15, -0.52], [0, 0, 0.38]),
    box(m.metal, [0.012, 0.26, 0.012], [0.06, -0.15, -0.52], [0, 0, -0.38]),
    boltGroup,
    magazine,
  ];

  return assemble(
    parts,
    {
      muzzle: anchor([0, 0.005, -0.93]),
      ejectionPort: anchor([0.04, 0.04, 0.02]),
      sight: anchor([0, 0.105, -0.02]),
    },
    { bolt: boltGroup, magazine },
  );
}

const BUILDERS: Record<WeaponId, (materials: WeaponMaterials) => WeaponModel> = {
  m4a1: buildM4A1,
  ak47: buildAK47,
  m60: buildM60,
  l96: buildL96,
};

export function createWeaponModel(id: WeaponId, materials: WeaponMaterials): WeaponModel {
  return BUILDERS[id](materials);
}
