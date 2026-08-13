import * as THREE from 'three';

export type NukePhase = 'idle' | 'ascend' | 'drop' | 'blast' | 'descend';

/** Height the camera pulls back to for the top down shot. */
const CAMERA_HEIGHT = 30;
/** Height the bomb is released from. */
const RELEASE_HEIGHT = 46;
const ASCEND_TIME = 1.1;
const DROP_TIME = 1.5;
const BLAST_TIME = 1.5;
const DESCEND_TIME = 0.9;
const BLAST_RADIUS = 34;

const tmpTarget = new THREE.Vector3();
const tmpUp = new THREE.Vector3(0, 0, -1);
const tmpMatrix = new THREE.Matrix4();

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (1 - t) * (1 - t) * 2;
}

/**
 * The nuclear jackpot: the camera pulls straight up, a bomb drops onto the
 * mansion, and everything belonging to the current round goes with it.
 *
 * Written as an explicit phase machine that owns the camera outright while it
 * runs. The mode stops feeding the camera rig and calls {@link applyCamera}
 * instead, so there is never a frame where two things are both trying to place
 * the camera. Detonation is reported once, on the frame the blast starts, so
 * the caller cannot double count the kills.
 */
export class NukeSequence {
  private readonly group = new THREE.Group();
  private readonly bomb: THREE.Mesh;
  private readonly flash: THREE.Mesh;
  private readonly shockwave: THREE.Mesh;
  private readonly light: THREE.PointLight;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  private phase: NukePhase = 'idle';
  private timer = 0;
  private readonly centre = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly originQuaternion = new THREE.Quaternion();

  constructor(private readonly scene: THREE.Scene) {
    const bombGeometry = new THREE.CapsuleGeometry(0.55, 1.7, 4, 10);
    const bombMaterial = new THREE.MeshPhongMaterial({ color: 0x3d434c, shininess: 60 });
    this.bomb = new THREE.Mesh(bombGeometry, bombMaterial);
    this.bomb.visible = false;

    const flashGeometry = new THREE.SphereGeometry(1, 20, 14);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff3d0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.flash = new THREE.Mesh(flashGeometry, flashMaterial);
    this.flash.visible = false;

    const waveGeometry = new THREE.RingGeometry(0.9, 1, 48);
    const waveMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd08a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.shockwave = new THREE.Mesh(waveGeometry, waveMaterial);
    this.shockwave.rotation.x = -Math.PI / 2;
    this.shockwave.visible = false;

    this.light = new THREE.PointLight(0xffe9bd, 0, 90, 2);
    this.light.visible = false;

    this.disposables.push(
      bombGeometry,
      bombMaterial,
      flashGeometry,
      flashMaterial,
      waveGeometry,
      waveMaterial,
    );
    this.group.add(this.bomb, this.flash, this.shockwave, this.light);
    scene.add(this.group);
  }

  get isActive(): boolean {
    return this.phase !== 'idle';
  }

  get currentPhase(): NukePhase {
    return this.phase;
  }

  /** Starts the sequence over a point, from wherever the camera is now. */
  begin(centre: THREE.Vector3, camera: THREE.PerspectiveCamera): void {
    if (this.isActive) return;
    this.phase = 'ascend';
    this.timer = 0;
    this.centre.copy(centre);
    this.origin.copy(camera.position);
    this.originQuaternion.copy(camera.quaternion);

    this.bomb.visible = true;
    this.bomb.position.set(centre.x, RELEASE_HEIGHT, centre.z);
    this.flash.visible = false;
    this.shockwave.visible = false;
    this.light.visible = false;
  }

  /**
   * Advances the sequence.
   *
   * @returns true on the single frame the bomb lands, which is when the round
   *   should be wiped and the points paid out.
   */
  update(dt: number): boolean {
    if (this.phase === 'idle') return false;
    this.timer += dt;

    switch (this.phase) {
      case 'ascend':
        if (this.timer >= ASCEND_TIME) this.advance('drop');
        return false;
      case 'drop':
        return this.updateDrop();
      case 'blast':
        this.updateBlast();
        if (this.timer >= BLAST_TIME) this.advance('descend');
        return false;
      default:
        if (this.timer >= DESCEND_TIME) this.reset();
        return false;
    }
  }

  /**
   * Places the camera while the sequence owns it. Called after the rig has run
   * so the override always wins.
   */
  applyCamera(camera: THREE.PerspectiveCamera): void {
    if (this.phase === 'idle') return;

    const blend = this.cameraBlend();
    tmpTarget.set(this.centre.x, CAMERA_HEIGHT, this.centre.z);
    camera.position.lerpVectors(this.origin, tmpTarget, blend);

    // Straight down, with the world's −Z as "up" on screen so the mansion
    // reads as a floor plan rather than spinning.
    tmpMatrix.lookAt(camera.position, this.centre, tmpUp);
    camera.quaternion.slerpQuaternions(
      this.originQuaternion,
      new THREE.Quaternion().setFromRotationMatrix(tmpMatrix),
      blend,
    );
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
    this.scene.remove(this.group);
  }

  private advance(phase: NukePhase): void {
    this.phase = phase;
    this.timer = 0;
  }

  private updateDrop(): boolean {
    const t = Math.min(1, this.timer / DROP_TIME);
    // Accelerating fall, so it arrives rather than drifts down.
    this.bomb.position.y = RELEASE_HEIGHT * (1 - t * t);
    this.bomb.rotation.x = -0.35 + t * 0.35;
    if (t < 1) return false;

    this.advance('blast');
    this.bomb.visible = false;
    this.flash.visible = true;
    this.shockwave.visible = true;
    this.light.visible = true;
    this.flash.position.set(this.centre.x, 2, this.centre.z);
    this.shockwave.position.set(this.centre.x, 0.4, this.centre.z);
    this.light.position.set(this.centre.x, 8, this.centre.z);
    return true;
  }

  private updateBlast(): void {
    const t = Math.min(1, this.timer / BLAST_TIME);
    const fade = 1 - t;

    const flashMaterial = this.flash.material as THREE.MeshBasicMaterial;
    this.flash.scale.setScalar(2 + t * BLAST_RADIUS * 0.55);
    flashMaterial.opacity = fade * fade * 0.9;

    const waveMaterial = this.shockwave.material as THREE.MeshBasicMaterial;
    this.shockwave.scale.setScalar(1 + t * BLAST_RADIUS);
    waveMaterial.opacity = fade * 0.85;

    this.light.intensity = fade * 260;
  }

  private cameraBlend(): number {
    switch (this.phase) {
      case 'ascend':
        return easeInOut(Math.min(1, this.timer / ASCEND_TIME));
      case 'descend':
        return 1 - easeInOut(Math.min(1, this.timer / DESCEND_TIME));
      default:
        return 1;
    }
  }

  private reset(): void {
    this.phase = 'idle';
    this.timer = 0;
    this.bomb.visible = false;
    this.flash.visible = false;
    this.shockwave.visible = false;
    this.light.visible = false;
  }
}
