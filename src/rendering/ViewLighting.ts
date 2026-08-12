import * as THREE from 'three';

/**
 * Lights for the first person weapon pass. The weapon scene is shared by
 * every mode, so this is installed once by the app shell.
 */
export function installViewLighting(viewScene: THREE.Scene): void {
  viewScene.add(new THREE.HemisphereLight(0xc8dcf0, 0x6d6a63, 2));

  const key = new THREE.DirectionalLight(0xfff4e2, 2.6);
  key.position.set(0.6, 1.2, 0.9);
  viewScene.add(key);

  const rim = new THREE.DirectionalLight(0x9fc0e8, 0.8);
  rim.position.set(-0.9, 0.3, -0.7);
  viewScene.add(rim);
}
