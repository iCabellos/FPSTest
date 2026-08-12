import * as THREE from 'three';
import { createFlashTexture } from '../../rendering/textures';
import { clamp, damp, lerp, randomSigned } from '../../utils/math';
import { disposeObject } from '../../utils/three';
import type { WeaponDefinition, WeaponId } from '../WeaponDefinition';
import type { Weapon } from '../Weapon';
import {
  createWeaponMaterials,
  createWeaponModel,
  disposeWeaponMaterials,
  type WeaponMaterials,
  type WeaponModel,
} from './WeaponModelFactory';

export interface ViewModelFrame {
  adsFactor: number;
  moveFraction: number;
  lookDeltaX: number;
  lookDeltaY: number;
  weapon: Weapon;
}

const FLASH_DURATION = 0.045;
/** How far the magazine falls away before it is swapped, in metres. */
const MAGAZINE_DROP = 0.34;

const boltState = { rotation: 0, offset: 0 };

/** Lift, pull, push, close: where the bolt sits during the cycle. */
function boltPose(progress: number): typeof boltState {
  if (progress < 0.22) {
    boltState.rotation = (progress / 0.22) * 1.5;
    boltState.offset = 0;
  } else if (progress < 0.5) {
    boltState.rotation = 1.5;
    boltState.offset = ((progress - 0.22) / 0.28) * 0.085;
  } else if (progress < 0.8) {
    boltState.rotation = 1.5;
    boltState.offset = (1 - (progress - 0.5) / 0.3) * 0.085;
  } else {
    boltState.rotation = (1 - (progress - 0.8) / 0.2) * 1.5;
    boltState.offset = 0;
  }
  return boltState;
}

/**
 * Reload timeline, as a fraction of the weapon's reload time. The magazine
 * falls away, is swapped off screen, is driven back home, and the action is
 * then cycled.
 */
const RELOAD = {
  dropEnd: 0.22,
  emptyEnd: 0.42,
  insertEnd: 0.78,
  rackStart: 0.82,
  rackEnd: 0.96,
} as const;

/**
 * Drives the first person weapon: ADS blend, sway, bob, recoil kick, reload
 * and bolt animation. Models are built once and cached per weapon.
 */
export class ViewModel {
  readonly root = new THREE.Group();

  private readonly materials: WeaponMaterials = createWeaponMaterials();
  private readonly models = new Map<WeaponId, WeaponModel>();
  private readonly flash: THREE.Mesh;
  private readonly adsPosition = new THREE.Vector3();
  private readonly magazineRest = new THREE.Vector3();

  private model: WeaponModel | null = null;
  private definition: WeaponDefinition | null = null;
  private magazineRestPitch = 0;

  private swayYaw = 0;
  private swayPitch = 0;
  private bobPhase = 0;
  private kickBack = 0;
  private kickPitch = 0;
  private kickRoll = 0;
  private flashTimer = 0;

  constructor(viewScene: THREE.Scene) {
    viewScene.add(this.root);

    const flashMaterial = new THREE.MeshBasicMaterial({
      map: createFlashTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), flashMaterial);
    this.flash.visible = false;
    this.flash.renderOrder = 5;
  }

  setWeapon(definition: WeaponDefinition): void {
    if (this.model) this.root.remove(this.model.group);

    let model = this.models.get(definition.id);
    if (!model) {
      model = createWeaponModel(definition.id, this.materials);
      this.models.set(definition.id, model);
    }

    this.model = model;
    this.definition = definition;
    this.root.add(model.group);
    model.muzzle.add(this.flash);

    if (model.magazine) {
      this.magazineRest.copy(model.magazine.position);
      this.magazineRestPitch = model.magazine.rotation.x;
      model.magazine.visible = true;
    }

    // Aiming puts the weapon's own sight on the screen centre, so a new model
    // lines itself up from its anchor instead of hand tuned offsets.
    const { adsDistance } = definition.viewModel;
    this.adsPosition.set(
      -model.sight.position.x,
      -model.sight.position.y,
      -adsDistance - model.sight.position.z,
    );

    this.swayYaw = 0;
    this.swayPitch = 0;
    this.kickBack = 0;
    this.kickPitch = 0;
    this.kickRoll = 0;
  }

  /** Called once per shot with the recoil impulse of the current weapon. */
  applyKick(kickback: number, punch: number): void {
    this.kickBack += kickback;
    this.kickPitch += punch;
    this.kickRoll += randomSigned(punch * 0.4);
    this.flashTimer = FLASH_DURATION;
    this.flash.rotation.z = Math.random() * Math.PI;
    const scale = 0.85 + Math.random() * 0.5;
    this.flash.scale.set(scale, scale, scale);
  }

  update(dt: number, frame: ViewModelFrame): void {
    const model = this.model;
    const definition = this.definition;
    if (!model || !definition) return;

    const config = definition.viewModel;
    const ads = frame.adsFactor;
    const ease = ads * ads * (3 - 2 * ads);

    this.updateSway(dt, frame, config.swayAmount, config.weight, ease);
    this.bobPhase += dt * 8.5 * frame.moveFraction;

    this.kickBack = damp(this.kickBack, 0, 13, dt);
    this.kickPitch = damp(this.kickPitch, 0, 10, dt);
    this.kickRoll = damp(this.kickRoll, 0, 10, dt);

    const hip = config.hipPosition;
    const bobScale = (1 - ease * 0.85) * config.bobAmount * frame.moveFraction;
    const bobX = Math.sin(this.bobPhase) * 0.012 * bobScale;
    const bobY = Math.sin(this.bobPhase * 2) * 0.008 * bobScale;

    const weapon = frame.weapon;
    const drawing = 1 - weapon.equipProgress;
    const equipDrop = drawing * 0.3;
    const reload = weapon.reloadProgress;
    // Reload pose: pull the weapon back and roll the magazine well toward the
    // eye, so the swap happens on screen instead of below the frame.
    const reloading = reload > 0 ? Math.sin(reload * Math.PI) : 0;

    this.root.position.set(
      lerp(hip[0], this.adsPosition.x, ease) + bobX + this.swayYaw * 0.25 - reloading * 0.04,
      lerp(hip[1], this.adsPosition.y, ease) +
        bobY -
        equipDrop -
        reloading * 0.035 +
        this.swayPitch * 0.25,
      lerp(hip[2], this.adsPosition.z, ease) + this.kickBack + reloading * 0.07,
    );

    const hipRotation = config.hipRotation;
    this.root.rotation.set(
      lerp(hipRotation[0], 0, ease) +
        this.kickPitch +
        this.swayPitch +
        reloading * 0.16 -
        drawing * 0.45,
      lerp(hipRotation[1], 0, ease) + this.swayYaw + reloading * 0.3,
      lerp(hipRotation[2], 0, ease) + this.kickRoll + reloading * 0.62 + drawing * 0.4,
    );

    this.updateMagazine(model, reload);
    this.updateAction(dt, model, weapon, reload);
    this.updateFlash(dt);

    // Effects query muzzle and ejection port in the same frame.
    this.root.updateMatrixWorld(true);
  }

  /** Hides the weapon when the scope overlay takes over. */
  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  /** Muzzle position expressed in world space. */
  getMuzzleWorld(camera: THREE.Camera, target: THREE.Vector3): THREE.Vector3 {
    if (!this.model) return target.set(0, 0, 0);
    this.model.muzzle.getWorldPosition(target);
    return camera.localToWorld(target);
  }

  getEjectionWorld(camera: THREE.Camera, target: THREE.Vector3): THREE.Vector3 {
    if (!this.model) return target.set(0, 0, 0);
    this.model.ejectionPort.getWorldPosition(target);
    return camera.localToWorld(target);
  }

  dispose(): void {
    for (const model of this.models.values()) disposeObject(model.group);
    this.models.clear();
    disposeWeaponMaterials(this.materials);
    disposeObject(this.flash);
    this.root.removeFromParent();
  }

  private updateSway(
    dt: number,
    frame: ViewModelFrame,
    amount: number,
    weight: number,
    ease: number,
  ): void {
    const scale = 0.00028 * amount * (1 - ease * 0.75);
    this.swayYaw = clamp(this.swayYaw + frame.lookDeltaX * scale, -0.08, 0.08);
    this.swayPitch = clamp(this.swayPitch + frame.lookDeltaY * scale, -0.08, 0.08);
    this.swayYaw = damp(this.swayYaw, 0, weight, dt);
    this.swayPitch = damp(this.swayPitch, 0, weight, dt);
  }

  /** Drops the spent magazine, swaps it off screen and drives the new one home. */
  private updateMagazine(model: WeaponModel, progress: number): void {
    const magazine = model.magazine;
    if (!magazine) return;

    if (progress <= 0) {
      if (!magazine.visible) magazine.visible = true;
      magazine.position.copy(this.magazineRest);
      magazine.rotation.x = this.magazineRestPitch;
      return;
    }

    if (progress < RELOAD.dropEnd) {
      const t = progress / RELOAD.dropEnd;
      magazine.visible = true;
      // Accelerating fall, tipping forward out of the magazine well.
      magazine.position.set(
        this.magazineRest.x,
        this.magazineRest.y - MAGAZINE_DROP * t * t,
        this.magazineRest.z + 0.03 * t,
      );
      magazine.rotation.x = this.magazineRestPitch - 0.9 * t * t;
      return;
    }

    if (progress < RELOAD.emptyEnd) {
      magazine.visible = false;
      return;
    }

    if (progress < RELOAD.insertEnd) {
      const t = (progress - RELOAD.emptyEnd) / (RELOAD.insertEnd - RELOAD.emptyEnd);
      // Decelerating push, so it settles into the well rather than snapping.
      const eased = 1 - (1 - t) * (1 - t);
      magazine.visible = true;
      magazine.position.set(
        this.magazineRest.x,
        this.magazineRest.y - MAGAZINE_DROP * (1 - eased),
        this.magazineRest.z,
      );
      magazine.rotation.x = this.magazineRestPitch - 0.45 * (1 - eased);
      return;
    }

    magazine.visible = true;
    magazine.position.copy(this.magazineRest);
    magazine.rotation.x = this.magazineRestPitch;
  }

  /** Bolt travel from firing, from the bolt cycle, and from the reload rack. */
  private updateAction(dt: number, model: WeaponModel, weapon: Weapon, reload: number): void {
    const bolt = model.bolt;
    if (!bolt) return;

    if (weapon.definition.boltCycleTime && reload === 0) {
      const pose = boltPose(weapon.boltProgress);
      bolt.position.z = pose.offset;
      bolt.rotation.z = pose.rotation;
      return;
    }

    if (reload >= RELOAD.rackStart && reload <= RELOAD.rackEnd) {
      // One firm pull and release to chamber the first round.
      const t = (reload - RELOAD.rackStart) / (RELOAD.rackEnd - RELOAD.rackStart);
      bolt.position.z = Math.sin(t * Math.PI) * 0.06;
      bolt.rotation.z = 0;
      return;
    }

    // Semi and full auto actions snap back within a few frames.
    const target = this.flashTimer > 0 ? 0.028 : 0;
    bolt.position.z = damp(bolt.position.z, target, 34, dt);
    bolt.rotation.z = 0;
  }

  private updateFlash(dt: number): void {
    if (this.flashTimer <= 0) {
      if (this.flash.visible) this.flash.visible = false;
      return;
    }
    this.flashTimer -= dt;
    this.flash.visible = this.flashTimer > 0;
  }
}
