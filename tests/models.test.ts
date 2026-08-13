import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createWeaponMaterials,
  createWeaponModel,
  disposeWeaponMaterials,
  type WeaponModel,
} from '../src/weapons/viewmodel/WeaponModelFactory';
import { ALL_WEAPONS, WEAPONS_BY_ID } from '../src/weapons/definitions';
import type { WeaponId } from '../src/weapons/WeaponDefinition';

const materials = createWeaponMaterials();
const models = new Map<WeaponId, WeaponModel>(
  ALL_WEAPONS.map((weapon) => [weapon.id, createWeaponModel(weapon.id, materials)]),
);

function countMeshes(model: WeaponModel): number {
  let meshes = 0;
  model.group.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes++;
  });
  return meshes;
}

describe('weapon models', () => {
  it('builds a model for every weapon in the loadout', () => {
    expect(models.size).toBe(ALL_WEAPONS.length);
    for (const model of models.values()) expect(model.group.children.length).toBeGreaterThan(0);
  });

  it('assembles each weapon from a real set of parts', () => {
    for (const [id, model] of models) {
      // A recognisable weapon needs a receiver, barrel, furniture and sights.
      expect(countMeshes(model), id).toBeGreaterThanOrEqual(14);
    }
  });

  it('puts the sight on the bore centreline so aiming lines up', () => {
    for (const [id, model] of models) {
      expect(Math.abs(model.sight.position.x), id).toBeLessThan(0.005);
      // Sights sit above the bore, never level with or below it.
      expect(model.sight.position.y, id).toBeGreaterThan(0.03);
      expect(model.sight.position.y, id).toBeLessThan(0.2);
    }
  });

  it('gives every weapon its own sight picture', () => {
    const anchors = [...models.values()].map(
      (model) => `${model.sight.position.y.toFixed(4)}:${model.sight.position.z.toFixed(4)}`,
    );
    expect(new Set(anchors).size).toBe(models.size);
  });

  it('points the muzzle forward, clear of the receiver', () => {
    for (const [id, model] of models) {
      // Sidearms are short; everything still points well past the grip.
      expect(model.muzzle.position.z, id).toBeLessThan(-0.15);
      expect(Math.abs(model.muzzle.position.x), id).toBeLessThan(0.01);
      // The muzzle has to sit on the bore line or the tracer leaves crooked.
      expect(Math.abs(model.muzzle.position.y), id).toBeLessThan(0.03);
    }
  });

  it('ejects brass out of the right hand side, above the grip', () => {
    for (const [id, model] of models) {
      expect(model.ejectionPort.position.x, id).toBeGreaterThan(0);
      expect(model.ejectionPort.position.y, id).toBeGreaterThan(-0.01);
    }
  });

  it('hangs the magazine below the bore so the reload swap reads', () => {
    for (const [id, model] of models) {
      // A weapon with no spare ammunition is never reloaded, so it has no
      // magazine swap to animate and is not required to model one.
      if (WEAPONS_BY_ID[id].reserveAmmo === 0) continue;
      expect(model.magazine, id).not.toBeNull();
      expect(model.magazine!.position.y, id).toBeLessThanOrEqual(0);
    }
  });

  it('exposes an animated action on every weapon', () => {
    for (const [id, model] of models) expect(model.bolt, id).not.toBeNull();
  });

  it('keeps each weapon within first person proportions', () => {
    const bounds = new THREE.Box3();
    for (const [id, model] of models) {
      bounds.setFromObject(model.group);
      const size = bounds.getSize(new THREE.Vector3());
      // Roughly weapon sized: nothing stretched or collapsed by a bad transform.
      expect(size.z, id).toBeGreaterThan(0.2);
      expect(size.z, id).toBeLessThan(1.4);
      expect(size.y, id).toBeLessThan(0.6);
      expect(size.x, id).toBeLessThan(0.35);
    }
  });

  it('keeps the sidearms clearly shorter than the shoulder weapons', () => {
    const length = (id: WeaponId): number => {
      const bounds = new THREE.Box3().setFromObject(models.get(id)!.group);
      return bounds.getSize(new THREE.Vector3()).z;
    };
    for (const pistol of ['m9', 'm1911'] as const) {
      expect(length(pistol), pistol).toBeLessThan(length('mp7'));
    }
  });

  it('gives the two sidearms different proportions', () => {
    const m9 = models.get('m9')!;
    const m1911 = models.get('m1911')!;
    expect(m9.sight.position.y).not.toBe(m1911.sight.position.y);
    expect(m9.muzzle.position.z).not.toBe(m1911.muzzle.position.z);
  });

  it('makes the submachine guns shorter than the rifles', () => {
    const length = (id: WeaponId): number => {
      const bounds = new THREE.Box3().setFromObject(models.get(id)!.group);
      return bounds.getSize(new THREE.Vector3()).z;
    };
    expect(length('mp7')).toBeLessThan(length('mp5'));
    expect(length('mp5')).toBeLessThan(length('m4a1'));
    expect(length('m4a1')).toBeLessThan(length('l96'));
  });

  it('releases every geometry it created', () => {
    const scratch = createWeaponMaterials();
    const model = createWeaponModel('m4a1', scratch);
    let disposed = 0;
    model.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.addEventListener('dispose', () => disposed++);
    });

    const meshes = countMeshes(model);
    model.group.traverse((object) => (object as THREE.Mesh).geometry?.dispose());
    disposeWeaponMaterials(scratch);
    expect(disposed).toBe(meshes);
  });
});
