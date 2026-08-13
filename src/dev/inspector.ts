/**
 * Weapon inspector — a development tool, not part of the game.
 *
 * The first person view only ever shows one weapon, from one angle, in motion,
 * at the edge of the frame. That is the worst possible place to notice that a
 * part is floating, mirrored, buried inside the receiver or half a centimetre
 * off the bore line. This page renders the same models the game uses, from
 * fixed orthographic angles, with the bore line and every anchor drawn on top,
 * so those mistakes are obvious instead of invisible.
 *
 * It is served by `npm run dev` at `/inspect.html` and is deliberately left out
 * of the production build.
 *
 *   /inspect.html?sheet=top          contact sheet of every weapon, from above
 *   /inspect.html?sheet=left         ... and from the left, right, bottom, ...
 *   /inspect.html?weapon=m4a1&view=left   one weapon, large
 *   /inspect.html?fp=m4a1            first person, through the real ViewModel
 *   /inspect.html?fp=m4a1&ads=1      ... aimed
 *   /inspect.html?fp=m4a1&pull=0.6   ... with the camera drawn back, so the
 *                                    whole weapon is in frame in its real
 *                                    hip pose rather than half off screen
 *   /inspect.html?fp=slotmachine&spin=1.2   ... 1.2 seconds into a spin of the
 *                                    special weapon, reels turning and the
 *                                    marquee chasing
 *
 * Extra flags: `&anchors=0` hides the anchor markers, `&grid=0` hides the
 * reference grid, `&wire=1` draws wireframe.
 */
import * as THREE from 'three';
import { VIEWMODEL_CAMERA } from '../core/constants';
import { installViewLighting } from '../rendering/ViewLighting';
import { SlotMachineAnimator } from '../special/SlotMachineAnimator';
import { ALL_WEAPONS, WEAPONS_BY_ID } from '../weapons/definitions';
import type { WeaponDefinition, WeaponId } from '../weapons/WeaponDefinition';
import { ViewModel } from '../weapons/viewmodel/ViewModel';
import {
  createWeaponMaterials,
  createWeaponModel,
  type WeaponMaterials,
  type WeaponModel,
} from '../weapons/viewmodel/WeaponModelFactory';

type ViewName = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back' | 'iso';

/**
 * Where each view sits, in the weapon's own space. The weapon points down −Z
 * with its bore on Y = 0, so "left" is the side you see from −X.
 */
const VIEWS: Record<ViewName, { eye: [number, number, number]; up: [number, number, number] }> = {
  top: { eye: [0, 1, 0], up: [0, 0, -1] },
  bottom: { eye: [0, -1, 0], up: [0, 0, 1] },
  left: { eye: [-1, 0, 0], up: [0, 1, 0] },
  right: { eye: [1, 0, 0], up: [0, 1, 0] },
  front: { eye: [0, 0, -1], up: [0, 1, 0] },
  back: { eye: [0, 0, 1], up: [0, 1, 0] },
  iso: { eye: [0.8, 0.55, 0.9], up: [0, 1, 0] },
};

const ANCHOR_COLOURS = {
  muzzle: 0xff5252,
  ejectionPort: 0xffd54f,
  sight: 0x4fc3f7,
  magazine: 0x81c784,
  bolt: 0xba68c8,
} as const;

const params = new URLSearchParams(location.search);
const showAnchors = params.get('anchors') !== '0';
const showGrid = params.get('grid') !== '0';
const wireframe = params.get('wire') === '1';

const host = document.getElementById('inspector') as HTMLElement;
document.body.style.margin = '0';
document.body.style.background = '#12161c';
document.body.style.color = '#dbe4f0';
document.body.style.font = '13px ui-monospace, "SF Mono", Menlo, monospace';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setClearColor(0x12161c);
host.append(renderer.domElement);

const materials = createWeaponMaterials();
if (wireframe) {
  for (const material of Object.values(materials)) {
    (material as THREE.MeshPhongMaterial).wireframe = true;
  }
}

// ---------------------------------------------------------------- utilities

function label(text: string, size = 44): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dbe4f0';
  ctx.font = `bold ${size}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Squeeze rather than clip: long names still have to be readable.
  const maxWidth = canvas.width - 32;
  ctx.fillText(text, canvas.width / 2, 64, maxWidth);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }),
  );
  sprite.scale.set(0.4, 0.1, 1);
  return sprite;
}

/** Marker at an anchor, so a mislaid muzzle or sight is impossible to miss. */
function marker(colour: number, radius = 0.011): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 10, 8),
    new THREE.MeshBasicMaterial({ color: colour, depthTest: false, transparent: true, opacity: 0.95 }),
  );
}

/**
 * Reference frame drawn around a weapon: the bore line the model is supposed
 * to be built on, plus centimetre ticks along it.
 */
function referenceFrame(): THREE.Object3D {
  const frame = new THREE.Group();
  const points: number[] = [];
  const colours: number[] = [];
  const push = (
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    r: number, g: number, b: number,
  ): void => {
    points.push(x1, y1, z1, x2, y2, z2);
    colours.push(r, g, b, r, g, b);
  };

  // Bore line: Y = 0, X = 0, running the length of the weapon.
  push(0, 0, 0.55, 0, 0, -0.75, 0.35, 0.75, 1);
  // Vertical and lateral centrelines through the receiver.
  push(0, -0.2, 0, 0, 0.2, 0, 0.28, 0.34, 0.42);
  push(-0.2, 0, 0, 0.2, 0, 0, 0.28, 0.34, 0.42);
  // Ten centimetre ticks along the bore.
  for (let z = -0.7; z <= 0.5001; z += 0.1) {
    const major = Math.abs(z % 0.5) < 1e-6;
    const size = major ? 0.028 : 0.014;
    const shade = major ? 0.6 : 0.3;
    push(-size, 0, z, size, 0, z, shade * 0.5, shade, shade);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  frame.add(
    new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 }),
    ),
  );
  return frame;
}

function anchorMarkers(model: WeaponModel): THREE.Object3D {
  const markers = new THREE.Group();
  const add = (object: THREE.Object3D | null, colour: number, radius?: number): void => {
    if (!object) return;
    const dot = marker(colour, radius);
    object.getWorldPosition(dot.position);
    markers.add(dot);
  };
  model.group.updateMatrixWorld(true);
  add(model.muzzle, ANCHOR_COLOURS.muzzle, 0.013);
  add(model.ejectionPort, ANCHOR_COLOURS.ejectionPort);
  add(model.sight, ANCHOR_COLOURS.sight);
  add(model.magazine, ANCHOR_COLOURS.magazine);
  add(model.bolt, ANCHOR_COLOURS.bolt, 0.009);
  return markers;
}

function lighting(target: THREE.Object3D): void {
  target.add(new THREE.AmbientLight(0xffffff, 1.1));
  target.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a2f38, 1.5));
  for (const [x, y, z, intensity] of [
    [2, 3, 2, 1.5],
    [-3, 1, -1, 0.9],
    [0, -3, 1, 0.5],
  ] as const) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    light.position.set(x, y, z);
    target.add(light);
  }
}

/** Bounding box of a model, used to frame it and to report its extents. */
function measure(model: WeaponModel): THREE.Box3 {
  model.group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model.group);
}

// ------------------------------------------------------------- orthographic

interface Cell {
  weapon: WeaponDefinition;
  model: WeaponModel;
  box: THREE.Box3;
}

function buildCells(ids: readonly WeaponId[], shared: WeaponMaterials): Cell[] {
  return ids.map((id) => {
    const model = createWeaponModel(id, shared);
    return { weapon: WEAPONS_BY_ID[id], model, box: measure(model) };
  });
}

/**
 * Lays the requested weapons out in a grid and renders them all with one
 * orthographic camera per cell, so a single screenshot covers the whole
 * arsenal from one angle.
 */
function renderSheet(view: ViewName, ids: readonly WeaponId[], single: boolean): void {
  const scene = new THREE.Scene();
  lighting(scene);

  const cells = buildCells(ids, materials);
  const columns = single ? 1 : Math.ceil(Math.sqrt(cells.length * 0.7));
  const rows = Math.ceil(cells.length / columns);

  const cellWidth = single ? 1000 : 420;
  const cellHeight = single ? 620 : 290;
  const width = cellWidth * columns;
  const height = cellHeight * rows + 40;
  renderer.setSize(width, height);

  // Every cell gets its own camera, so each weapon is framed on its own size.
  const cameras: Array<{ camera: THREE.OrthographicCamera; x: number; y: number }> = [];
  cells.forEach((cell, index) => {
    const holder = new THREE.Group();
    holder.add(cell.model.group);
    if (showGrid) holder.add(referenceFrame());
    if (showAnchors) holder.add(anchorMarkers(cell.model));

    const column = index % columns;
    const row = Math.floor(index / columns);
    // Spread the cells out in world space so their cameras never overlap.
    holder.position.set(column * 100, -row * 100, 0);
    scene.add(holder);

    const size = cell.box.getSize(new THREE.Vector3());
    const centre = cell.box.getCenter(new THREE.Vector3());
    const aspect = cellWidth / cellHeight;
    // Frame on the two axes the camera actually sees, with a margin.
    const spans: Record<ViewName, [number, number]> = {
      top: [size.x, size.z],
      bottom: [size.x, size.z],
      left: [size.z, size.y],
      right: [size.z, size.y],
      front: [size.x, size.y],
      back: [size.x, size.y],
      iso: [Math.max(size.x, size.z), Math.max(size.y, size.z)],
    };
    const [spanX, spanY] = spans[view];
    const half = Math.max(spanX / aspect, spanY, 0.05) * 0.62;
    const { eye, up } = VIEWS[view];

    // Label goes at the top of this cell's own framing, measured along the
    // camera's own up axis — offsetting in world Y would push it toward the
    // lens rather than up the screen on the top and bottom views.
    const name = label(`${cell.weapon.name}  ·  ${view.toUpperCase()}`, 52);
    const lift = new THREE.Vector3(...up).multiplyScalar(half * 0.86);
    name.position.set(
      column * 100 + centre.x + lift.x,
      -row * 100 + centre.y + lift.y,
      centre.z + lift.z,
    );
    name.scale.set(half * 2.6, half * 0.33, 1);
    scene.add(name);

    const camera = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, -20, 20);
    camera.position.set(
      column * 100 + centre.x + eye[0] * 5,
      -row * 100 + centre.y + eye[1] * 5,
      centre.z + eye[2] * 5,
    );
    camera.up.set(...up);
    camera.lookAt(column * 100 + centre.x, -row * 100 + centre.y, centre.z);
    cameras.push({ camera, x: column * cellWidth, y: row * cellHeight });
  });

  renderer.setScissorTest(true);
  renderer.clear();
  for (const { camera, x, y } of cameras) {
    // Scissor origin is bottom left, so rows count up from the bottom.
    const bottom = height - y - cellHeight;
    renderer.setViewport(x, bottom, cellWidth, cellHeight);
    renderer.setScissor(x, bottom, cellWidth, cellHeight);
    renderer.render(scene, camera);
  }
  renderer.setScissorTest(false);

  report(cells);
}

/** Prints the measurements a reviewer would otherwise have to eyeball. */
function report(cells: readonly Cell[]): void {
  const rows = cells.map((cell) => {
    const size = cell.box.getSize(new THREE.Vector3());
    // Local to the model, not world: the sheet moves cells apart in world
    // space, and it is the model's own space these have to be right in.
    const muzzle = cell.model.muzzle.position;
    const sight = cell.model.sight.position;
    return {
      id: cell.weapon.id,
      length: +size.z.toFixed(3),
      height: +size.y.toFixed(3),
      width: +size.x.toFixed(3),
      muzzleY: +muzzle.y.toFixed(4),
      muzzleX: +muzzle.x.toFixed(4),
      muzzleZ: +muzzle.z.toFixed(3),
      // Distance from the muzzle anchor to the front of the model. Anything
      // much above zero means the anchor is floating out in front of the gun.
      muzzleGap: +(cell.box.min.z - muzzle.z).toFixed(3),
      sightY: +sight.y.toFixed(4),
      sightX: +sight.x.toFixed(4),
      minY: +cell.box.min.y.toFixed(3),
      maxY: +cell.box.max.y.toFixed(3),
      minZ: +cell.box.min.z.toFixed(3),
    };
  });
  // Read back by the automated inspection pass.
  (window as unknown as { __inspect: unknown }).__inspect = rows;
  console.table(rows);
}

// ------------------------------------------------------------- first person

/**
 * The real first person rig: the same `ViewModel`, the same view camera, the
 * same hip and aimed poses. This is where floating parts and anything not
 * actually attached to the weapon show up.
 */
function renderFirstPerson(id: WeaponId, ads: boolean, pull: number, spin: number): void {
  const width = 900;
  const height = 560;
  renderer.setSize(width, height);
  renderer.setViewport(0, 0, width, height);

  const scene = new THREE.Scene();
  // The game's own view lighting, not the inspector's: the whole point of this
  // view is to see exactly what the player sees.
  installViewLighting(scene);
  const camera = new THREE.PerspectiveCamera(
    VIEWMODEL_CAMERA.fov,
    width / height,
    VIEWMODEL_CAMERA.near,
    VIEWMODEL_CAMERA.far,
  );

  const viewModel = new ViewModel(scene);
  const definition = WEAPONS_BY_ID[id];
  viewModel.setWeapon(definition);

  // Settle the pose: no sway, no bob, no kick, and either hip or fully aimed.
  const weapon = {
    equipProgress: 1,
    reloadProgress: 0,
    boltProgress: 0,
    definition,
  } as unknown as Parameters<ViewModel['update']>[1]['weapon'];
  for (let i = 0; i < 240; i++) {
    viewModel.update(1 / 60, {
      adsFactor: ads ? 1 : 0,
      moveFraction: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      weapon,
    });
  }

  // Wind the cabinet forward into a spin, so the reels and the light show can
  // be checked mid flight rather than only at rest.
  if (spin > 0) {
    const model = viewModel.currentModel;
    const animator = new SlotMachineAnimator(model?.extras);
    animator.spin({ symbols: ['nuclear', 'grenade', 'x', 'nuclear', 'grenade'], jackpot: false });
    for (let elapsed = 0; elapsed < spin; elapsed += 1 / 120) animator.update(1 / 120);
  }

  // A crosshair, so it is obvious whether the sight actually lines up on it.
  // Drawing the camera back leaves the pose untouched and only moves the
  // observer, so what is checked is exactly what the player is holding.
  camera.position.z = pull;

  const cross = new THREE.Group();
  const crossMaterial = new THREE.LineBasicMaterial({ color: 0x4fc3f7, depthTest: false });
  const arm = 0.006;
  const crossGeometry = new THREE.BufferGeometry();
  crossGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-arm, 0, 0, arm, 0, 0, 0, -arm, 0, 0, arm, 0],
      3,
    ),
  );
  cross.add(new THREE.LineSegments(crossGeometry, crossMaterial));
  cross.position.set(0, 0, -0.5);
  camera.add(cross);
  scene.add(camera);

  renderer.render(scene, camera);

  const model = createWeaponModel(id, materials);
  report([{ weapon: definition, model, box: measure(model) }]);
  const caption = document.createElement('div');
  caption.style.padding = '8px 12px';
  caption.textContent = `${definition.name} — first person, ${ads ? 'aimed' : 'hip'}${
    pull > 0 ? `, pulled back ${pull}m` : ''
  }`;
  host.append(caption);
}

// -------------------------------------------------------------------- entry

const fp = params.get('fp') as WeaponId | null;
const requested = params.get('weapon') as WeaponId | null;
const sheet = params.get('sheet') as ViewName | null;
const view = (params.get('view') as ViewName | null) ?? 'left';

if (fp && WEAPONS_BY_ID[fp]) {
  renderFirstPerson(
    fp,
    params.get('ads') === '1',
    Number(params.get('pull') ?? 0),
    Number(params.get('spin') ?? 0),
  );
} else if (requested && WEAPONS_BY_ID[requested]) {
  renderSheet(view, [requested], true);
} else {
  const ids = ALL_WEAPONS.map((weapon) => weapon.id);
  renderSheet(sheet ?? view, ids, false);
}
