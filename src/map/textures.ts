import * as THREE from 'three';
import type { FloorStyle } from './layout';

function canvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [element, ctx];
}

function finish(element: HTMLCanvasElement, repeat: number): THREE.Texture {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

/** Speckled grime, used to age every surface. */
function grime(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha: number): void {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 1 + Math.random() * 9;
    ctx.fillStyle = `rgba(24, 20, 18, ${(Math.random() * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Dried blood: a pooled centre with a few runs off it. Used sparingly so the
 * mansion reads as somewhere an outbreak happened rather than a slaughterhouse.
 */
function bloodSplatter(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  ctx.fillStyle = 'rgba(86, 16, 14, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y, 14 * scale, 10 * scale, Math.random() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = (10 + Math.random() * 26) * scale;
    ctx.fillStyle = 'rgba(74, 12, 11, 0.45)';
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      (1 + Math.random() * 3.4) * scale,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

/**
 * Interior wall: panelled plaster, water staining down from the ceiling, and
 * the occasional splatter. The staining runs top to bottom, which reads as
 * neglect once the lights are low.
 */
export function createWallTexture(): THREE.Texture {
  const size = 256;
  const [element, ctx] = canvas(size);

  ctx.fillStyle = '#8d8577';
  ctx.fillRect(0, 0, size, size);

  // Panelling: a dado rail with slightly darker boards beneath it.
  ctx.fillStyle = '#7b7365';
  ctx.fillRect(0, size * 0.62, size, size * 0.38);
  ctx.fillStyle = '#5f584d';
  ctx.fillRect(0, size * 0.6, size, 5);
  for (let x = 0; x < size; x += 32) {
    ctx.fillStyle = 'rgba(60, 55, 46, 0.35)';
    ctx.fillRect(x, size * 0.64, 2, size * 0.34);
  }

  // Damp running down from the top.
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * size;
    const width = 4 + Math.random() * 16;
    const gradient = ctx.createLinearGradient(0, 0, 0, size * 0.6);
    gradient.addColorStop(0, 'rgba(46, 42, 34, 0.4)');
    gradient.addColorStop(1, 'rgba(46, 42, 34, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 0, width, size * 0.6);
  }

  grime(ctx, size, 90, 0.28);
  bloodSplatter(ctx, Math.random() * size, size * (0.55 + Math.random() * 0.3), 0.9);
  return finish(element, 3);
}

/** Floor treatments. Each room type gets its own so the map reads at a glance. */
export function createFloorTexture(style: FloorStyle, repeat: number): THREE.Texture {
  const size = 256;
  const [element, ctx] = canvas(size);

  switch (style) {
    case 'parquet':
      paintParquet(ctx, size);
      break;
    case 'tile':
      paintTile(ctx, size);
      break;
    case 'carpet':
      paintCarpet(ctx, size);
      break;
    case 'marble':
      paintMarble(ctx, size);
      break;
    case 'concrete':
      paintConcrete(ctx, size);
      break;
  }

  grime(ctx, size, 70, 0.24);
  if (style !== 'concrete') bloodSplatter(ctx, Math.random() * size, Math.random() * size, 1.1);
  return finish(element, Math.max(1, Math.round(repeat)));
}

function paintParquet(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#4a3121';
  ctx.fillRect(0, 0, size, size);
  const block = size / 4;
  for (let bx = 0; bx < 4; bx++) {
    for (let bz = 0; bz < 4; bz++) {
      const vertical = (bx + bz) % 2 === 0;
      for (let i = 0; i < 4; i++) {
        const shade = 60 + Math.random() * 26;
        ctx.fillStyle = `rgb(${shade + 22}, ${shade - 6}, ${shade - 24})`;
        if (vertical) {
          ctx.fillRect(bx * block + i * (block / 4), bz * block, block / 4 - 1.5, block - 1.5);
        } else {
          ctx.fillRect(bx * block, bz * block + i * (block / 4), block - 1.5, block / 4 - 1.5);
        }
      }
    }
  }
}

function paintTile(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#3c4046';
  ctx.fillRect(0, 0, size, size);
  const tile = size / 8;
  for (let x = 0; x < 8; x++) {
    for (let z = 0; z < 8; z++) {
      const light = (x + z) % 2 === 0;
      const shade = light ? 168 + Math.random() * 20 : 74 + Math.random() * 16;
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade - 4})`;
      ctx.fillRect(x * tile + 1, z * tile + 1, tile - 2, tile - 2);
    }
  }
}

function paintCarpet(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#4a2530';
  ctx.fillRect(0, 0, size, size);
  // Fibrous noise, then a faint border pattern.
  for (let i = 0; i < 5000; i++) {
    const shade = Math.random() * 28;
    ctx.fillStyle = `rgba(${90 + shade}, ${40 + shade}, ${52 + shade}, 0.5)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  ctx.strokeStyle = 'rgba(150, 120, 70, 0.3)';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, size - 28, size - 28);
}

function paintMarble(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#b9b6ae';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(90, 88, 84, 0.4)';
  for (let i = 0; i < 22; i++) {
    ctx.lineWidth = 0.5 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * size;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < size) {
      x += (Math.random() - 0.5) * 26;
      y += 12 + Math.random() * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Checkerboard inlay, so the entrance reads as the grand room.
  const tile = size / 4;
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 4; z++) {
      if ((x + z) % 2 !== 0) continue;
      ctx.fillStyle = 'rgba(46, 46, 50, 0.5)';
      ctx.fillRect(x * tile, z * tile, tile, tile);
    }
  }
}

function paintConcrete(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#57585a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const shade = 70 + Math.random() * 40;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 3}, 0.35)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
  }
  ctx.strokeStyle = 'rgba(36, 36, 38, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
}
