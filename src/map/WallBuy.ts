import * as THREE from 'three';
import type { WeaponDefinition } from '../weapons/WeaponDefinition';
import {
  createWeaponModel,
  type WeaponMaterials,
} from '../weapons/viewmodel/WeaponModelFactory';
import type { WallBuySpec, WallMount } from './layout';

/** Height the board hangs at, roughly eye level. */
const BOARD_Y = 1.55;
/** Exported so the layout can be checked for boards hung over openings. */
export const BOARD_WIDTH = 1.5;
const BOARD_HEIGHT = 0.78;

/**
 * A purchase point mounted flat on a wall: a chalked board with the price on
 * it and, for weapon buys, the weapon itself hanging in front of it.
 *
 * It owns only presentation and its own placement. Whether a purchase is
 * allowed — money, stock, what you already carry — is decided by the mode, so
 * the same board can never disagree with the economy behind it.
 */
export class WallBuy {
  readonly group = new THREE.Group();
  readonly id: string;
  /** Where the player has to stand and look to use it. */
  readonly position = new THREE.Vector3();
  readonly kind: WallBuySpec['kind'];
  readonly cost: number;
  readonly refillCost: number;
  readonly label: string;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly display: THREE.Object3D | null = null;
  private glow = 0;

  constructor(
    readonly spec: WallBuySpec,
    mount: WallMount,
    weapon: WeaponDefinition | null,
    weaponMaterials: WeaponMaterials,
  ) {
    this.id = spec.id;
    this.kind = spec.kind;
    this.cost = spec.cost;
    this.refillCost = spec.refillCost;
    this.label = weapon ? weapon.name : 'AMMO';

    this.group.position.set(mount.x, 0, mount.z);
    this.group.rotation.y = mount.rotationY;
    // Interaction is judged against the point in front of the board, not the
    // wall itself, so standing beside it does not count.
    this.position.set(mount.x + mount.inwardX * 0.5, BOARD_Y, mount.z + mount.inwardZ * 0.5);

    this.buildBoard();
    this.display = weapon ? this.buildWeapon(weapon, weaponMaterials) : this.buildAmmoCrate();
    if (this.display) this.group.add(this.display);
  }

  /**
   * Bobs and turns the goods so a wall buy catches the eye across a dark room,
   * and brightens while the player is stood at it.
   */
  update(dt: number, highlighted: boolean, time: number): void {
    this.glow += (Number(highlighted) - this.glow) * Math.min(1, dt * 8);
    if (!this.display) return;
    this.display.position.y = BOARD_Y + Math.sin(time * 1.6) * 0.02 + this.glow * 0.04;
    this.display.rotation.z = Math.sin(time * 0.9) * 0.05;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.group.removeFromParent();
  }

  private buildBoard(): void {
    const texture = new THREE.CanvasTexture(this.paintBoard());
    texture.anisotropy = 4;
    this.textures.push(texture);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    this.materials.push(material);

    const geometry = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT);
    this.geometries.push(geometry);

    const board = new THREE.Mesh(geometry, material);
    board.position.set(0, BOARD_Y, 0.02);
    this.group.add(board);
  }

  /** Chalk on peeling plaster: the price, and what it buys. */
  private paintBoard(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 268;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    ctx.setLineDash([]);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232, 238, 246, 0.86)';
    ctx.font = 'bold 58px "Courier New", monospace';
    ctx.fillText(this.label, canvas.width / 2, 96);

    ctx.fillStyle = 'rgba(255, 214, 122, 0.92)';
    ctx.font = 'bold 84px "Courier New", monospace';
    ctx.fillText(`$${this.cost}`, canvas.width / 2, 196);

    ctx.fillStyle = 'rgba(200, 210, 224, 0.6)';
    ctx.font = '30px "Courier New", monospace';
    ctx.fillText(
      this.kind === 'ammo' ? 'REFILL WHAT YOU HOLD' : `AMMO $${this.refillCost}`,
      canvas.width / 2,
      240,
    );

    // A little chalk dust, so it does not read as a printed sign.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    for (let i = 0; i < 220; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }
    return canvas;
  }

  private buildWeapon(weapon: WeaponDefinition, materials: WeaponMaterials): THREE.Object3D {
    const model = createWeaponModel(weapon.id, materials);
    const holder = new THREE.Group();
    // Turned side on so the whole profile faces the room, muzzle to the left.
    model.group.rotation.set(0, Math.PI / 2, 0);
    model.group.scale.setScalar(1.25);
    holder.add(model.group);
    holder.position.set(0, BOARD_Y, 0.24);
    return holder;
  }

  private buildAmmoCrate(): THREE.Object3D {
    const crate = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(0.62, 0.34, 0.36);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4326 });
    this.geometries.push(bodyGeometry);
    this.materials.push(bodyMaterial);
    crate.add(new THREE.Mesh(bodyGeometry, bodyMaterial));

    const bandGeometry = new THREE.BoxGeometry(0.66, 0.05, 0.4);
    const bandMaterial = new THREE.MeshLambertMaterial({ color: 0x2c2a1c });
    this.geometries.push(bandGeometry);
    this.materials.push(bandMaterial);
    for (const y of [-0.1, 0.1]) {
      const band = new THREE.Mesh(bandGeometry, bandMaterial);
      band.position.y = y;
      crate.add(band);
    }

    // Loose rounds standing in the open lid, so it reads as ammo at a glance.
    const roundGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.09, 6);
    const brassMaterial = new THREE.MeshPhongMaterial({ color: 0xc7a24a, shininess: 60 });
    this.geometries.push(roundGeometry);
    this.materials.push(brassMaterial);
    for (let i = 0; i < 6; i++) {
      const round = new THREE.Mesh(roundGeometry, brassMaterial);
      round.position.set(-0.22 + i * 0.088, 0.21, 0.06);
      round.rotation.z = (i - 2.5) * 0.08;
      crate.add(round);
    }

    crate.position.set(0, BOARD_Y, 0.28);
    return crate;
  }
}
