import * as THREE from 'three';
import { RENDER } from '../core/constants';
import { createSkyTexture } from './textures';

/**
 * Outdoor lighting: one shadow casting sun plus hemisphere fill. A single
 * shadowed light keeps the cost predictable.
 */
export class Environment {
  readonly sun: THREE.DirectionalLight;
  private readonly skyDome: THREE.Mesh;

  constructor(scene: THREE.Scene, viewScene: THREE.Scene) {
    const skyTexture = createSkyTexture();
    const skyGeometry = new THREE.SphereGeometry(600, 24, 12);
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    this.skyDome.renderOrder = -1;
    this.skyDome.matrixAutoUpdate = false;
    scene.add(this.skyDome);

    scene.add(new THREE.HemisphereLight(0xbdd7f2, 0x8a7f6e, 1.4));
    // Small fill so surfaces facing away from the sun keep some detail.
    scene.add(new THREE.AmbientLight(0x9fb0c4, 0.5));

    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.7);
    this.sun.position.set(48, 62, 34);
    this.sun.target.position.set(0, 0, -22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;

    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -34;
    shadowCamera.right = 34;
    shadowCamera.top = 34;
    shadowCamera.bottom = -34;
    shadowCamera.near = 1;
    shadowCamera.far = 220;
    shadowCamera.updateProjectionMatrix();

    scene.add(this.sun);
    scene.add(this.sun.target);

    // The weapon pass has its own scene, so it needs its own (cheap) lights.
    viewScene.add(new THREE.HemisphereLight(0xc8dcf0, 0x6d6a63, 2));
    const viewKey = new THREE.DirectionalLight(0xfff4e2, 2.6);
    viewKey.position.set(0.6, 1.2, 0.9);
    viewScene.add(viewKey);
    const viewRim = new THREE.DirectionalLight(0x9fc0e8, 0.8);
    viewRim.position.set(-0.9, 0.3, -0.7);
    viewScene.add(viewRim);
  }

  dispose(): void {
    this.skyDome.geometry.dispose();
    (this.skyDome.material as THREE.Material).dispose();
    this.sun.shadow.dispose();
    this.sun.dispose();
  }
}
