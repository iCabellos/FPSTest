import * as THREE from 'three';

const created: THREE.Texture[] = [];

function canvas(size: number, height = size): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = height;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [element, ctx];
}

function register(texture: THREE.Texture, srgb: boolean): THREE.Texture {
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  created.push(texture);
  return texture;
}

/** Frees every texture built here. Called on teardown. */
export function disposeGeneratedTextures(): void {
  for (const texture of created) texture.dispose();
  created.length = 0;
  bulletHoleTexture = null;
}

export function createNoiseTexture(base: string, contrast: number, repeat: number): THREE.Texture {
  const [element, ctx] = canvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const image = ctx.getImageData(0, 0, 256, 256);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * contrast;
    data[i] = THREE.MathUtils.clamp(data[i] + n, 0, 255);
    data[i + 1] = THREE.MathUtils.clamp(data[i + 1] + n, 0, 255);
    data[i + 2] = THREE.MathUtils.clamp(data[i + 2] + n, 0, 255);
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return register(texture, true);
}

let bulletHoleTexture: THREE.Texture | null = null;

/** Memoised: decals on targets and on the range share one texture. */
export function createBulletHoleTexture(): THREE.Texture {
  if (bulletHoleTexture) return bulletHoleTexture;
  const [element, ctx] = canvas(128);
  ctx.clearRect(0, 0, 128, 128);

  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 58);
  gradient.addColorStop(0, 'rgba(8,8,10,1)');
  gradient.addColorStop(0.35, 'rgba(20,18,16,0.92)');
  gradient.addColorStop(0.62, 'rgba(90,80,70,0.45)');
  gradient.addColorStop(1, 'rgba(120,110,100,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();

  // Radial cracks keep holes from reading as perfect circles.
  ctx.strokeStyle = 'rgba(35,32,30,0.55)';
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    const length = 18 + Math.random() * 26;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + Math.cos(angle) * length, 64 + Math.sin(angle) * length);
    ctx.stroke();
  }
  bulletHoleTexture = register(new THREE.CanvasTexture(element), true);
  return bulletHoleTexture;
}

export function createTargetFaceTexture(): THREE.Texture {
  const [element, ctx] = canvas(256);
  const rings: Array<[number, string]> = [
    [128, '#e8e4dc'],
    [104, '#d94f3d'],
    [80, '#e8e4dc'],
    [56, '#d94f3d'],
    [30, '#e8e4dc'],
    [14, '#2b2b30'],
  ];
  for (const [radius, color] of rings) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(128, 128, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,40,45,0.5)';
  ctx.lineWidth = 2;
  for (const [radius] of rings) {
    ctx.beginPath();
    ctx.arc(128, 128, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  return register(new THREE.CanvasTexture(element), true);
}

export function createSignTexture(label: string): THREE.Texture {
  const [element, ctx] = canvas(256, 128);
  ctx.fillStyle = '#16181c';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#f5f1e6';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 68);
  return register(new THREE.CanvasTexture(element), true);
}

export function createSkyTexture(): THREE.Texture {
  const [element, ctx] = canvas(8, 256);
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#3f74b8');
  gradient.addColorStop(0.45, '#8fb4d9');
  gradient.addColorStop(0.72, '#c3d3de');
  gradient.addColorStop(1, '#d8d2c4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 256);
  return register(new THREE.CanvasTexture(element), true);
}

export function createGlowTexture(inner: string, outer: string): THREE.Texture {
  const [element, ctx] = canvas(128);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.4, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return register(new THREE.CanvasTexture(element), true);
}

/** Four point star used for the muzzle flash quad. */
export function createFlashTexture(): THREE.Texture {
  const [element, ctx] = canvas(128);
  const core = ctx.createRadialGradient(64, 64, 0, 64, 64, 34);
  core.addColorStop(0, 'rgba(255,250,225,1)');
  core.addColorStop(0.5, 'rgba(255,196,90,0.75)');
  core.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 128, 128);

  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,225,150,0.55)';
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, -60);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  return register(new THREE.CanvasTexture(element), true);
}
