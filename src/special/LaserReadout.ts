import * as THREE from 'three';
import { PITY_MAX, type SlotSymbol } from './SlotMachine';

/** Vertex budget: five glyphs plus the pity bar, with room to spare. */
const MAX_VERTICES = 192;
const LIFETIME = 2.8;
/** Half height of one symbol glyph, in metres at the projection plane. */
const GLYPH = 0.085;
const GLYPH_SPACING = 0.26;
const PITY_Y = -0.22;
const PITY_WIDTH = 1.1;

const COLOURS: Record<SlotSymbol, number> = {
  x: 0xff4d4d,
  grenade: 0xffb347,
  nuclear: 0x6cff9a,
};
const PITY_LIT = 0x8fd2ff;
const PITY_DARK = 0x223543;
const PITY_READY = 0xffd166;

const tmpColour = new THREE.Color();

/**
 * The special weapon's readout, projected into the world as laser strokes.
 *
 * The result of a spin is not HUD text: it is drawn where the weapon is
 * pointing, on the wall or in the air, so the player reads it without looking
 * away from what is walking at them. Five symbol glyphs across the top, and a
 * bar of {@link PITY_MAX} ticks underneath showing how close the next
 * guaranteed jackpot is.
 *
 * One geometry with a fixed vertex budget is rewritten in place on each spin,
 * so showing a result allocates nothing.
 */
export class LaserReadout {
  private readonly lines: THREE.LineSegments;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.LineBasicMaterial;
  private readonly positions = new Float32Array(MAX_VERTICES * 3);
  private readonly colours = new Float32Array(MAX_VERTICES * 3);
  private cursor = 0;
  private life = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colours, 3));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
    this.lines.visible = false;
    scene.add(this.lines);
  }

  get isVisible(): boolean {
    return this.life > 0;
  }

  /**
   * Projects one spin.
   *
   * @param anchor where the beams land, normally the first surface in front.
   * @param facing orientation the readout squares up to, i.e. the camera's.
   */
  show(
    anchor: THREE.Vector3,
    facing: THREE.Quaternion,
    symbols: readonly SlotSymbol[],
    pity: number,
    guaranteed: boolean,
  ): void {
    this.cursor = 0;

    const start = -((symbols.length - 1) * GLYPH_SPACING) / 2;
    for (let i = 0; i < symbols.length; i++) {
      this.drawGlyph(symbols[i], start + i * GLYPH_SPACING, 0);
    }
    this.drawPity(pity, guaranteed);

    this.geometry.setDrawRange(0, this.cursor);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    this.lines.position.copy(anchor);
    this.lines.quaternion.copy(facing);
    this.lines.visible = true;
    this.life = LIFETIME;
  }

  update(dt: number): void {
    if (this.life <= 0) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.lines.visible = false;
      this.material.opacity = 0;
      return;
    }
    // Holds bright, then falls away quickly at the end.
    const remaining = this.life / LIFETIME;
    this.material.opacity = Math.min(1, remaining * 2.2);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.lines);
  }

  private segment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    colour: number,
  ): void {
    if (this.cursor + 2 > MAX_VERTICES) return;
    tmpColour.setHex(colour);
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ]) {
      const offset = this.cursor * 3;
      this.positions[offset] = x;
      this.positions[offset + 1] = y;
      this.positions[offset + 2] = 0;
      this.colours[offset] = tmpColour.r;
      this.colours[offset + 1] = tmpColour.g;
      this.colours[offset + 2] = tmpColour.b;
      this.cursor++;
    }
  }

  /** One symbol: a cross, a ring, or the trefoil that means nuclear. */
  private drawGlyph(symbol: SlotSymbol, cx: number, cy: number): void {
    const colour = COLOURS[symbol];
    if (symbol === 'x') {
      this.segment(cx - GLYPH, cy - GLYPH, cx + GLYPH, cy + GLYPH, colour);
      this.segment(cx - GLYPH, cy + GLYPH, cx + GLYPH, cy - GLYPH, colour);
      return;
    }

    if (symbol === 'grenade') {
      this.polygon(cx, cy, GLYPH, 8, 0, colour);
      return;
    }

    // Nuclear: three spokes inside a triangle, so it reads as a trefoil.
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
      this.segment(cx, cy, cx + Math.cos(angle) * GLYPH, cy + Math.sin(angle) * GLYPH, colour);
    }
    this.polygon(cx, cy, GLYPH * 1.05, 3, Math.PI / 2, colour);
  }

  private polygon(
    cx: number,
    cy: number,
    radius: number,
    sides: number,
    offset: number,
    colour: number,
  ): void {
    for (let i = 0; i < sides; i++) {
      const a = offset + (i / sides) * Math.PI * 2;
      const b = offset + ((i + 1) / sides) * Math.PI * 2;
      this.segment(
        cx + Math.cos(a) * radius,
        cy + Math.sin(a) * radius,
        cx + Math.cos(b) * radius,
        cy + Math.sin(b) * radius,
        colour,
      );
    }
  }

  /** Ticks lit left to right; all gold once the next spin cannot lose. */
  private drawPity(pity: number, guaranteed: boolean): void {
    const step = PITY_WIDTH / (PITY_MAX - 1);
    for (let i = 0; i < PITY_MAX; i++) {
      const x = -PITY_WIDTH / 2 + i * step;
      const lit = i < pity;
      const colour = guaranteed ? PITY_READY : lit ? PITY_LIT : PITY_DARK;
      const height = lit || guaranteed ? 0.05 : 0.024;
      this.segment(x, PITY_Y - height, x, PITY_Y + height, colour);
    }
  }
}
