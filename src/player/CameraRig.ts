import * as THREE from 'three';
import { CAMERA } from '../core/constants';
import { clamp, damp } from '../utils/math';

const tmpOffset = new THREE.Vector3();

/**
 * Turns look input, recoil and ADS state into the final camera transform.
 * Recoil arrives as two channels: a transient offset that recovers on its own
 * and a permanent kick folded into the aim angles, which is what makes a
 * pattern learnable.
 */
export class CameraRig {
  yaw = 0;
  pitch = 0;

  private fov: number = CAMERA.baseFov;
  private fovTarget: number = CAMERA.baseFov;
  private shake = 0;
  private shakeSeed = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  applyLook(deltaX: number, deltaY: number, sensitivity: number): void {
    this.yaw -= deltaX * CAMERA.lookSpeed * sensitivity;
    this.pitch -= deltaY * CAMERA.lookSpeed * sensitivity;
    this.clampPitch();
  }

  /** Permanent recoil displacement: the player has to correct for this. */
  addAimOffset(pitch: number, yaw: number): void {
    this.pitch += pitch;
    this.yaw += yaw;
    this.clampPitch();
  }

  /**
   * Steers the aim toward a world point. Used by touch auto aim, which snaps
   * onto a target when the fire stick is pressed rather than asking a thumb
   * to track it.
   */
  aimAt(target: THREE.Vector3, eye: THREE.Vector3, dt: number, strength: number): void {
    tmpOffset.subVectors(target, eye);
    const flat = Math.hypot(tmpOffset.x, tmpOffset.z);
    if (flat < 1e-4) return;

    const desiredYaw = Math.atan2(-tmpOffset.x, -tmpOffset.z);
    const desiredPitch = Math.atan2(tmpOffset.y, flat);

    let deltaYaw = desiredYaw - this.yaw;
    while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
    while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

    const blend = 1 - Math.exp(-strength * dt);
    this.yaw += deltaYaw * blend;
    this.pitch += (desiredPitch - this.pitch) * blend;
    this.clampPitch();
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
    this.shakeSeed = Math.random() * 100;
  }

  setFovTarget(fov: number): void {
    this.fovTarget = fov;
  }

  /** Snaps the FOV, used when switching weapons out of a scope. */
  resetFov(fov: number): void {
    this.fovTarget = fov;
    this.fov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  update(
    dt: number,
    eyePosition: THREE.Vector3,
    eyeHeight: number,
    lean: number,
    recoilPitch: number,
    recoilYaw: number,
  ): void {
    this.shake = Math.max(0, this.shake - dt * 4.5);

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + recoilPitch, this.yaw + recoilYaw, lean);

    this.camera.position.set(eyePosition.x, eyeHeight, eyePosition.z);
    if (this.shake > 0) {
      const magnitude = this.shake * this.shake * 0.022;
      const time = performance.now() * 0.05 + this.shakeSeed;
      tmpOffset.set(Math.sin(time * 1.7) * magnitude, Math.sin(time * 2.3) * magnitude, 0);
      tmpOffset.applyQuaternion(this.camera.quaternion);
      this.camera.position.add(tmpOffset);
    }

    const nextFov = damp(this.fov, this.fovTarget, CAMERA.fovSmoothing, dt);
    if (Math.abs(nextFov - this.fov) > 0.001) {
      this.fov = nextFov;
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
  }

  private clampPitch(): void {
    this.pitch = clamp(this.pitch, -CAMERA.maxPitch, CAMERA.maxPitch);
  }
}
