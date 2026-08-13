import type * as THREE from 'three';
import {
  anchor,
  assemble,
  box,
  group,
  hollowTube,
  magazine,
  notchRearSight,
  pin,
  post,
  ring,
  tube,
  type WeaponMaterials,
  type WeaponModel,
} from '../parts';

export interface PistolOptions {
  /** Slide bulk. The single biggest cue for how heavy a pistol looks. */
  slideHeight: number;
  slideLength: number;
  barrelRadius: number;
  magazineHeight: number;
  magazineWidth?: number;
  /** Rear notch width. */
  notchGap: number;
  /** Ribbed slide serrations sit further back on the heavier guns. */
  heavy?: boolean;
  /** Exposed barrel out of the front of the slide, e.g. the M9. */
  openTop?: boolean;
  /** Accessory rail under the dust cover. */
  railed?: boolean;
  slideMaterial?: THREE.Material;
  frameMaterial?: THREE.Material;
  gripMaterial?: THREE.Material;
  /** Straight sided grip, or the 1911's raked one. */
  gripAngle?: number;
  /** Extra barrel out past the slide, for guns with a long underlug. */
  barrelExtension?: number;
}

/**
 * Shared slide pistol skeleton: slide over frame, barrel through the slide,
 * grip raked back with the magazine inside it, hammer and beavertail at the
 * back. The three pistols differ in bulk, sight, rail and grip angle rather
 * than in construction, so they stay recognisably the same class of thing.
 */
export function buildPistol(m: WeaponMaterials, options: PistolOptions): WeaponModel {
  const slideMaterial = options.slideMaterial ?? m.blued;
  const frameMaterial = options.frameMaterial ?? m.darkMetal;
  const gripMaterial = options.gripMaterial ?? m.rubber;
  const gripAngle = options.gripAngle ?? 0.3;

  const slideY = options.slideHeight / 2 + 0.004;
  const sightY = slideY + options.slideHeight / 2 + 0.012;
  // Everything forward is measured from where the slide actually ends, so the
  // muzzle anchor can never drift away from the front of the gun.
  const slideFront = -0.05 - options.slideLength / 2;
  const muzzleZ = slideFront - 0.008 - (options.barrelExtension ?? 0);
  const nose = slideFront + 0.016;

  const mag = magazine(m, 'straight', {
    material: m.darkMetal,
    position: [0, -0.052, 0.024],
    width: options.magazineWidth ?? 0.026,
    depth: 0.036,
    height: options.magazineHeight,
  });

  // The slide is the reciprocating part, so everything on it lives in one group.
  const slideParts: THREE.Object3D[] = [
    box(slideMaterial, [0.03, options.slideHeight, options.slideLength], [0, slideY, -0.05]),
    box(slideMaterial, [0.032, 0.01, options.slideLength * 0.92], [0, slideY + options.slideHeight / 2, -0.05]),
  ];
  // Cocking serrations: ribs cut into the rear of the slide.
  for (let i = 0; i < 6; i++) {
    slideParts.push(
      box(
        m.darkMetal,
        [0.032, options.slideHeight * 0.7, 0.005],
        [0, slideY, (options.heavy ? 0.03 : 0.02) - i * 0.009],
      ),
    );
  }
  if (options.openTop) {
    // Open top slide: a bridge over an exposed barrel.
    slideParts.push(box(slideMaterial, [0.032, 0.012, 0.05], [0, slideY + options.slideHeight * 0.36, nose]));
  }
  slideParts.push(
    // Extractor and the ejection port on the right.
    box(m.metal, [0.006, 0.012, 0.03], [0.016, slideY + 0.004, -0.01]),
    box(m.rubber, [0.006, 0.018, 0.038], [0.015, slideY + 0.002, -0.012]),
  );
  const slide = group(slideParts);

  const parts: THREE.Object3D[] = [
    slide,
    // Barrel and crown, running from the breech out to the muzzle.
    tube(
      m.metal,
      options.barrelRadius,
      options.barrelRadius,
      Math.abs(muzzleZ - 0.03),
      [0, 0, (muzzleZ + 0.03) / 2],
    ),
    hollowTube(m.rubber, options.barrelRadius * 0.62, 0.03, [0, 0, muzzleZ + 0.008]),
    // Frame: dust cover forward, trigger guard and grip back.
    box(frameMaterial, [0.026, 0.024, options.slideLength * 0.72], [0, -0.014, -0.05]),
    box(frameMaterial, [0.03, 0.05, 0.09], [0, -0.03, 0.02]),
    // Grip, raked back, with the magazine inside it.
    box(gripMaterial, [0.03, 0.1, 0.044], [0, -0.078, 0.036], [gripAngle, 0, 0]),
    box(gripMaterial, [0.032, 0.012, 0.046], [0, -0.126, 0.052]),
    ...Array.from({ length: 5 }, (_unused, i) =>
      box(m.darkMetal, [0.033, 0.005, 0.01], [0, -0.05 - i * 0.016, 0.052 + i * 0.005], [gripAngle, 0, 0]),
    ),
    // Beavertail and hammer at the back.
    box(frameMaterial, [0.026, 0.014, 0.03], [0, -0.006, 0.05], [0.5, 0, 0]),
    box(m.metal, [0.008, 0.026, 0.012], [0, 0.006, 0.058], [-0.4, 0, 0]),
    ring(m.metal, 0.007, 0.0025, [0, 0.014, 0.062], 8),
    // Trigger and its guard.
    box(m.metal, [0.008, 0.024, 0.008], [0, -0.03, 0.006], [0.2, 0, 0]),
    box(frameMaterial, [0.008, 0.006, 0.05], [0, -0.048, -0.004]),
    box(frameMaterial, [0.008, 0.026, 0.006], [0, -0.034, -0.026]),
    // Slide stop and safety on the left.
    box(m.metal, [0.006, 0.01, 0.03], [-0.017, -0.004, 0.014]),
    post(m.metal, 0.006, 0.006, [-0.017, 0.006, 0.046], 8).rotateZ(Math.PI / 2),
    // Magazine release button.
    post(m.metal, 0.006, 0.008, [0.016, -0.03, 0.03], 8).rotateZ(Math.PI / 2),
    pin(m.metal, 0.004, 0.032, [0, -0.014, -0.03]),
    mag,
  ];

  if (options.railed) {
    parts.push(
      box(frameMaterial, [0.024, 0.012, 0.06], [0, -0.03, -0.062]),
      ...Array.from({ length: 3 }, (_unused, i) =>
        box(m.darkMetal, [0.026, 0.006, 0.005], [0, -0.037, -0.042 - i * 0.016]),
      ),
    );
  }

  parts.push(...notchRearSight(m, 0.052, sightY, sightY - 0.014, options.notchGap));
  // Front blade, on the same sight line.
  parts.push(
    box(m.darkMetal, [0.006, 0.014, 0.008], [0, sightY - 0.007, nose + 0.012]),
    box(m.metal, [0.004, 0.004, 0.004], [0, sightY, nose + 0.012]),
  );

  return assemble(parts, {
    muzzle: anchor([0, 0, muzzleZ]),
    ejectionPort: anchor([0.02, slideY + 0.004, -0.012]),
    sight: anchor([0, sightY, 0.052]),
    bolt: slide,
    magazine: mag,
  });
}

/** Beretta M9: open top slide, seventeen rounds, light and even shooting. */
export function buildM9(m: WeaponMaterials): WeaponModel {
  return buildPistol(m, {
    slideHeight: 0.042,
    slideLength: 0.21,
    barrelRadius: 0.0085,
    magazineHeight: 0.096,
    notchGap: 0.008,
    openTop: true,
    railed: true,
  });
}

/** Colt M1911: heavier slide, tighter notch, no rail, steeper grip. */
export function buildM1911(m: WeaponMaterials): WeaponModel {
  return buildPistol(m, {
    slideHeight: 0.05,
    slideLength: 0.2,
    barrelRadius: 0.0095,
    magazineHeight: 0.09,
    magazineWidth: 0.022,
    notchGap: 0.009,
    heavy: true,
    gripMaterial: m.wood,
    gripAngle: 0.34,
  });
}

/** Desert Eagle: gas operated, so it wears a huge slab slide with a top rail. */
export function buildDeagle(m: WeaponMaterials): WeaponModel {
  const model = buildPistol(m, {
    slideHeight: 0.062,
    slideLength: 0.25,
    barrelRadius: 0.012,
    magazineHeight: 0.1,
    magazineWidth: 0.03,
    notchGap: 0.01,
    heavy: true,
    railed: true,
    slideMaterial: m.metal,
    frameMaterial: m.metal,
    gripMaterial: m.rubber,
    gripAngle: 0.22,
    // The gas tube and its block reach out past the slide.
    barrelExtension: 0.036,
  });

  // What makes a Deagle a Deagle: a triangular slab slide, a gas tube slung
  // under the barrel, and a rail running the whole length of the top.
  const extras = group([
    box(m.metal, [0.034, 0.014, 0.24], [0, 0.072, -0.06]),
    ...Array.from({ length: 9 }, (_unused, i) =>
      box(m.darkMetal, [0.036, 0.008, 0.006], [0, 0.08, -0.16 + i * 0.024]),
    ),
    tube(m.metal, 0.008, 0.008, 0.17, [0, -0.026, -0.11]),
    box(m.metal, [0.026, 0.016, 0.03], [0, -0.026, -0.196]),
  ]);
  model.group.add(extras);
  return model;
}
