import type * as THREE from 'three';

/** Recursively frees geometries and materials owned by a subtree. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as Partial<THREE.Mesh>;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material?.dispose();
    }
  });
  root.removeFromParent();
}
