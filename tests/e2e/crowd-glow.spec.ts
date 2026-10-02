import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { bindCrowdGlowGeometry, createCrowdGlowGeometry, restoreCrowdGlowGeometry } from "../../components/experience/crowd-glow-geometry";
import { createBakedSceneMaterial, crowdGlowProfile, getCrowdGlowBrightnessWeight } from "../../components/experience/baked-scene-material";
import { createCrowdPeople } from "../../components/experience/crowd-person-inspection";
import { restoreRuntimeMaterial } from "../../components/experience/baked-material-binding";

test("glow normals smooth coincident atlas seams with triangle area weighting while authored geometry stays unchanged", () => {
  const source = new THREE.BufferGeometry();
  source.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 2, 0, 0, 0, 2, 0,
    0, 0, 0, 0, 0, 1, 2, 0, 0,
  ], 3));
  source.setAttribute("normal", new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  source.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0.8, 0.8, 0.6, 0.6, 0.7, 0.7], 2));
  source.addGroup(0, 3, 0);
  source.addGroup(3, 3, 1);
  const originalAttributes = Object.fromEntries(Object.entries(source.attributes).map(([name, attribute]) => [name, Array.from(attribute.array)]));
  const geometry = createCrowdGlowGeometry(source);
  const glow = geometry.getAttribute("glowNormal");
  const expected = new THREE.Vector3(0, 2, 4).normalize();
  const actual = new THREE.Vector3().fromBufferAttribute(glow, 0);
  expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
  expect(new THREE.Vector3().fromBufferAttribute(glow, 3).distanceTo(actual)).toBeLessThan(1e-6);
  expect(new THREE.Vector3().fromBufferAttribute(glow, 2).toArray()).toEqual([0, 0, 1]);
  expect(source.getAttribute("glowNormal")).toBeUndefined();
  expect(source.boundingBox).toBeNull();
  expect(geometry.groups).toEqual(source.groups);
  expect(geometry.index).toBe(source.index);
  for (const [name, values] of Object.entries(originalAttributes)) {
    expect(Array.from(source.getAttribute(name).array)).toEqual(values);
    expect(Array.from(geometry.getAttribute(name).array)).toEqual(values);
    expect(geometry.getAttribute(name)).not.toBe(source.getAttribute(name));
  }
  geometry.dispose();
  source.dispose();
});

test("indexed geometry retains topology and degenerate faces produce finite glow normals", () => {
  const source = new THREE.BoxGeometry();
  const index = Array.from(source.index!.array);
  const geometry = createCrowdGlowGeometry(source);
  expect(Array.from(geometry.index!.array)).toEqual(index);
  expect(geometry.index).not.toBe(source.index);
  const glow = geometry.getAttribute("glowNormal");
  for (let vertex = 0; vertex < glow.count; vertex += 1) {
    expect(new THREE.Vector3().fromBufferAttribute(glow, vertex).length()).toBeCloseTo(1, 6);
  }
  const degenerate = new THREE.BufferGeometry();
  degenerate.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  const fallback = createCrowdGlowGeometry(degenerate);
  expect(Array.from(fallback.getAttribute("glowNormal").array)).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  [geometry, source, fallback, degenerate].forEach((item) => item.dispose());
});

test("runtime glow geometry restores shared source assets and disposes only owned clones", () => {
  const root = new THREE.Group();
  const source = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const first = new THREE.Mesh(source, material);
  const second = new THREE.Mesh<THREE.BufferGeometry>(source, material);
  first.position.set(2, 3, 4);
  root.add(first, second);
  let sourceDisposals = 0;
  let ownedDisposals = 0;
  source.addEventListener("dispose", () => { sourceDisposals += 1; });
  const bindings = bindCrowdGlowGeometry(root);
  expect(first.geometry).toBe(second.geometry);
  expect(first.geometry).not.toBe(source);
  bindings[0].owned.addEventListener("dispose", () => { ownedDisposals += 1; });
  const foreign = new THREE.SphereGeometry();
  second.geometry = foreign;
  restoreCrowdGlowGeometry(bindings);
  expect(first.geometry).toBe(source);
  expect(second.geometry).toBe(foreign);
  expect(first.position.toArray()).toEqual([2, 3, 4]);
  expect(sourceDisposals).toBe(0);
  expect(ownedDisposals).toBe(1);
  source.dispose();
  foreign.dispose();
  material.dispose();
});

test("linear texture weighting preserves a gentle floor and gives brighter atlas texels more glow", () => {
  const values = [0, 0.004, 0.0352, 0.08, 0.14, 1].map(getCrowdGlowBrightnessWeight);
  expect(values[0]).toBe(crowdGlowProfile.brightnessFloor);
  expect(values[2]).toBeGreaterThan(0.35);
  expect(values[2]).toBeLessThan(0.5);
  expect(values[3]).toBeGreaterThan(values[2]);
  expect(values[4]).toBe(1);
  expect(values[5]).toBe(1);
  expect(getCrowdGlowBrightnessWeight(Number.NaN)).toBe(values[0]);
});

test("crowd light starts at the colour transition and focus remains isolated to the selected person", () => {
  const quietMap = new THREE.Texture();
  const peakMap = new THREE.Texture();
  const baked = createBakedSceneMaterial({ name: "test-crowd", quietMap, peakMap, edgeColor: "#fff", crowdFalloff: true });
  const ordinary = createBakedSceneMaterial({ name: "test-stage", quietMap, peakMap, edgeColor: "#fff" });
  expect(baked.uniforms.uPeakMix.value).toBe(0);
  expect(baked.material.defines.CROWD_FALLOFF).toBe(1);
  expect(ordinary.material.defines.CROWD_FALLOFF).toBeUndefined();
  const root = new THREE.Group();
  const source = new THREE.BoxGeometry();
  const sourceMaterial = new THREE.MeshBasicMaterial();
  for (let index = 0; index < 2; index += 1) {
    const person = new THREE.Mesh(source, sourceMaterial);
    person.name = `Human_${index}`;
    person.position.x = index * 2;
    root.add(person);
  }
  const people = createCrowdPeople(root, baked.material, baked.uniforms);
  people[0].focus.value = 1;
  expect(people[1].focus.value).toBe(0);
  expect(people[0].material.uniforms.uPersonFocus).not.toBe(people[1].material.uniforms.uPersonFocus);
  expect(people[0].material.uniforms.uQuietMap.value).toBe(quietMap);
  expect(people[1].material.uniforms.uPeakMap.value).toBe(peakMap);
  expect(people[0].material.uniforms.uPeakMix).toBe(baked.uniforms.uPeakMix);
  baked.uniforms.uPeakMix.value = 1;
  expect(people[1].material.uniforms.uPeakMix.value).toBe(1);
  people.forEach((person) => {
    restoreRuntimeMaterial(person.bindings, person.material);
    person.material.dispose();
    expect((person.object as THREE.Mesh).material).toBe(sourceMaterial);
  });
  [source, sourceMaterial, baked.material, ordinary.material, quietMap, peakMap].forEach((item) => item.dispose());
});
