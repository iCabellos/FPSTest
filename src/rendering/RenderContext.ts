import * as THREE from 'three';
import { CAMERA, RENDER, VIEWMODEL_CAMERA } from '../core/constants';

/**
 * Owns the renderer and the two render passes: the active world, then the
 * first person weapon drawn on a cleared depth buffer with its own camera so
 * it never intersects world geometry.
 *
 * The world scene belongs to whichever mode is running, so it is swapped in
 * rather than created here.
 */
export class RenderContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  /** Shared across modes: the first person weapon always renders here. */
  readonly viewScene = new THREE.Scene();
  readonly viewCamera: THREE.PerspectiveCamera;

  private world: THREE.Scene | null = null;
  private readonly onResize = () => this.resize();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Mostly static worlds, so shadows are rendered on demand.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;
    // Two render passes per frame, so stats are reset once by hand instead.
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAMERA.baseFov, 1, CAMERA.near, CAMERA.far);
    this.viewCamera = new THREE.PerspectiveCamera(
      VIEWMODEL_CAMERA.fov,
      1,
      VIEWMODEL_CAMERA.near,
      VIEWMODEL_CAMERA.far,
    );

    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setWorld(scene: THREE.Scene | null): void {
    this.world = scene;
  }

  /** Re-renders the shadow map once; call after the static scene changes. */
  refreshShadows(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  render(drawViewModel: boolean): void {
    if (!this.world) return;
    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.render(this.world, this.camera);
    if (!drawViewModel) return;
    this.renderer.clearDepth();
    this.renderer.render(this.viewScene, this.viewCamera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / Math.max(height, 1);
    this.renderer.setSize(width, height);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = aspect;
    this.viewCamera.updateProjectionMatrix();
  }
}
