import * as THREE from 'three';
import type { RandomSource } from '../utils/Random';
import type { WeaponDefinition, WeaponId } from '../weapons/WeaponDefinition';
import { WEAPONS_BY_ID } from '../weapons/definitions';
import {
  createWeaponModel,
  type WeaponMaterials,
} from '../weapons/viewmodel/WeaponModelFactory';

/**
 * What the box can hand out. Sidearms are in so a pull can genuinely
 * disappoint; the special weapon is not, because the vault wall is the one
 * place it comes from.
 */
export const BOX_POOL: readonly WeaponId[] = [
  'm4a1',
  'ak47',
  'scar',
  'g36',
  'fal',
  'm60',
  'l96',
  'mp5',
  'mp7',
  'ump45',
  'uzi',
  'r870',
  'spas12',
  'deagle',
  'revolver',
  'm1911',
];

export const BOX_COST = 950;

/** Seconds the lid stays open cycling through weapons. */
const SPIN_TIME = 3.4;
/** Seconds the winning weapon hangs there waiting to be taken. */
const OFFER_TIME = 5;
const CLOSE_TIME = 0.8;
/** How fast the models flick past while spinning. */
const CYCLE_INTERVAL = 0.11;
const HOVER_Y = 1.15;

export type BoxPhase = 'closed' | 'spinning' | 'offering' | 'closing';

/**
 * The mystery box: pay, watch the lid open and the guns flick past, take
 * whatever it settles on.
 *
 * It runs as a small explicit state machine rather than a stack of timers, so
 * there is exactly one place that decides what the box is doing. Nothing is
 * ever lost: if the offer times out the weapon is handed over anyway, so a
 * player who is busy staying alive is not simply charged for nothing.
 */
export class MysteryBox {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  /** Room the box landed in this match. */
  readonly room: string;

  private readonly lid = new THREE.Group();
  private readonly display = new THREE.Group();
  private readonly models = new Map<WeaponId, THREE.Object3D>();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private phase: BoxPhase = 'closed';
  private timer = 0;
  private cycleTimer = 0;
  private shown: WeaponId = BOX_POOL[0];
  private prize: WeaponId | null = null;
  private lidOpen = 0;
  private spin = 0;

  constructor(
    room: string,
    position: THREE.Vector3,
    weaponMaterials: WeaponMaterials,
    private readonly random: RandomSource = Math.random,
  ) {
    this.room = room;
    this.position.copy(position);
    this.group.position.copy(position);

    this.buildCrate();
    this.buildModels(weaponMaterials);
    this.group.add(this.lid, this.display);
  }

  get isBusy(): boolean {
    return this.phase !== 'closed';
  }

  get currentPhase(): BoxPhase {
    return this.phase;
  }

  /** The weapon on offer right now, or null when nothing is waiting. */
  get offered(): WeaponDefinition | null {
    return this.phase === 'offering' && this.prize ? WEAPONS_BY_ID[this.prize] : null;
  }

  /** Starts a spin. @returns false when the box is already running. */
  open(): boolean {
    if (this.phase !== 'closed') return false;
    this.phase = 'spinning';
    this.timer = SPIN_TIME;
    this.cycleTimer = 0;
    this.prize = null;
    return true;
  }

  /** Takes the weapon on offer, closing the box. */
  take(): WeaponDefinition | null {
    const weapon = this.offered;
    if (!weapon) return null;
    this.startClosing();
    return weapon;
  }

  /**
   * @returns the weapon when an untaken offer expires, so the mode can hand it
   * over rather than pocketing the player's money.
   */
  update(dt: number): WeaponDefinition | null {
    this.spin += dt * (this.phase === 'spinning' ? 5.5 : 1.1);
    this.display.rotation.y = this.spin;

    let granted: WeaponDefinition | null = null;
    if (this.phase !== 'closed') {
      this.timer -= dt;
      if (this.phase === 'spinning') {
        this.cycleWeapons(dt);
        if (this.timer <= 0) this.startOffering();
      } else if (this.phase === 'offering' && this.timer <= 0) {
        granted = this.prize ? WEAPONS_BY_ID[this.prize] : null;
        this.startClosing();
      } else if (this.phase === 'closing' && this.timer <= 0) {
        this.phase = 'closed';
      }
    }

    const target = this.phase === 'closed' || this.phase === 'closing' ? 0 : 1;
    this.lidOpen += (target - this.lidOpen) * Math.min(1, dt * 6);
    this.lid.rotation.x = -this.lidOpen * 1.35;
    this.display.visible = this.lidOpen > 0.05;
    this.display.position.y = HOVER_Y * this.lidOpen + Math.sin(this.spin * 0.7) * 0.03;
    this.display.scale.setScalar(0.6 + this.lidOpen * 0.4);

    return granted;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.models.clear();
    this.group.removeFromParent();
  }

  private startOffering(): void {
    this.phase = 'offering';
    this.timer = OFFER_TIME;
    this.prize = this.pick();
    this.showWeapon(this.prize);
  }

  private startClosing(): void {
    this.phase = 'closing';
    this.timer = CLOSE_TIME;
    this.prize = null;
  }

  private pick(): WeaponId {
    const index = Math.min(BOX_POOL.length - 1, Math.floor(this.random() * BOX_POOL.length));
    return BOX_POOL[index];
  }

  private cycleWeapons(dt: number): void {
    this.cycleTimer -= dt;
    if (this.cycleTimer > 0) return;
    this.cycleTimer = CYCLE_INTERVAL;
    this.showWeapon(this.pick());
  }

  private showWeapon(id: WeaponId): void {
    const previous = this.models.get(this.shown);
    if (previous) previous.visible = false;
    this.shown = id;
    const next = this.models.get(id);
    if (next) next.visible = true;
  }

  private buildCrate(): void {
    const wood = new THREE.MeshLambertMaterial({ color: 0x5d4326 });
    const iron = new THREE.MeshLambertMaterial({ color: 0x33383f });
    this.materials.push(wood, iron);

    const bodyGeometry = new THREE.BoxGeometry(1.3, 0.78, 0.9);
    this.geometries.push(bodyGeometry);
    const body = new THREE.Mesh(bodyGeometry, wood);
    body.position.y = 0.39;
    body.castShadow = true;
    this.group.add(body);

    const bandGeometry = new THREE.BoxGeometry(1.36, 0.08, 0.96);
    this.geometries.push(bandGeometry);
    for (const y of [0.18, 0.6]) {
      const band = new THREE.Mesh(bandGeometry, iron);
      band.position.y = y;
      this.group.add(band);
    }

    // The lid pivots on its back edge, so the group has to sit on that hinge.
    const lidGeometry = new THREE.BoxGeometry(1.34, 0.1, 0.94);
    this.geometries.push(lidGeometry);
    const panel = new THREE.Mesh(lidGeometry, wood);
    panel.position.set(0, 0, 0.47);
    this.lid.add(panel);
    this.lid.position.set(0, 0.82, -0.47);

    // A question mark daubed on the front, so the crate announces itself.
    const markGeometry = new THREE.PlaneGeometry(0.7, 0.5);
    this.geometries.push(markGeometry);
    const markTexture = new THREE.CanvasTexture(paintQuestionMark());
    const markMaterial = new THREE.MeshBasicMaterial({
      map: markTexture,
      transparent: true,
      depthWrite: false,
    });
    this.materials.push(markMaterial);
    for (const [rotation, x, z] of [
      [0, 0, 0.46],
      [Math.PI, 0, -0.46],
    ] as const) {
      const mark = new THREE.Mesh(markGeometry, markMaterial);
      mark.position.set(x, 0.42, z);
      mark.rotation.y = rotation;
      this.group.add(mark);
    }
  }

  private buildModels(materials: WeaponMaterials): void {
    for (const id of BOX_POOL) {
      const model = createWeaponModel(id, materials);
      model.group.rotation.set(0, Math.PI / 2, 0);
      model.group.visible = id === this.shown;
      this.models.set(id, model.group);
      this.display.add(model.group);
    }
    this.display.visible = false;
  }
}

function paintQuestionMark(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(238, 214, 130, 0.9)';
  ctx.font = 'bold 108px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 66);
  return canvas;
}
