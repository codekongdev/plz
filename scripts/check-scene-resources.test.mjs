import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Execute the shipped cleanup helpers with real three.js objects. Only the label DOM is a small mock.
async function engine() {
  const html = await readFile(new URL('../skills/plz-3d-explain/assets/template.html', import.meta.url), 'utf8');
  const start = html.indexOf('const allTags = ');
  const end = html.indexOf('// Actor cube', start);
  assert.ok(start >= 0 && end > start, 'the template must contain its label and cleanup helpers');
  class Element {
    constructor() { this.style = {}; this.parentNode = {}; this.ownerDocument = { defaultView: { Element } }; }
    setAttribute() {}
    remove() { this.parentNode = null; }
  }
  const labelState = new Map();
  const context = { THREE, CSS2DObject, labelState, document: { createElement: () => new Element() } };
  return { ...vm.runInNewContext(`${html.slice(start, end)}; ({ allTags, tag, temporaryGroup, disposeObject, clearGroup, clearTemporary })`, context), labelState };
}

function disposals(resource) {
  const count = { value: 0 };
  resource.addEventListener('dispose', () => { count.value += 1; });
  return count;
}

test('repeated packet disposal releases labels, DOM, state, and owned GPU resources', async () => {
  const e = await engine();
  const scene = new THREE.Group();
  const permanent = e.tag('permanent', [0, 0, 0]);
  scene.add(permanent);
  e.labelState.set(permanent, { x: 0, y: 0 });
  const temp = e.temporaryGroup();
  scene.add(temp);
  for (let i = 0; i < 20; i += 1) {
    const geometry = new THREE.SphereGeometry(0.2);
    const material = new THREE.MeshBasicMaterial();
    const geometryCount = disposals(geometry), materialCount = disposals(material);
    const packet = new THREE.Mesh(geometry, material);
    const label = e.tag(`request ${i}`, [0, 0, 0]);
    packet.add(label);
    temp.add(packet);
    e.labelState.set(label, { x: 2, y: 3 });
    e.disposeObject(packet);
    assert.equal(temp.children.length, 0);
    assert.equal(e.allTags.size, 1);
    assert.equal(e.labelState.size, 1);
    assert.equal(label.element.parentNode, null);
    assert.equal(geometryCount.value, 1);
    assert.equal(materialCount.value, 1);
  }
  assert.ok(e.allTags.has(permanent), 'permanent scene labels must remain registered');
  assert.ok(e.labelState.has(permanent));
});

test('clearing a temporary group deduplicates owned resources and protects explicit external ownership', async () => {
  const e = await engine();
  const ownedGeometry = new THREE.BoxGeometry(), ownedMaterial = new THREE.MeshBasicMaterial();
  const sharedGeometry = new THREE.BoxGeometry(), sharedMaterial = new THREE.MeshBasicMaterial();
  const ownedGeometryCount = disposals(ownedGeometry), ownedMaterialCount = disposals(ownedMaterial);
  const sharedGeometryCount = disposals(sharedGeometry), sharedMaterialCount = disposals(sharedMaterial);
  // An external owner may be built but not attached to the rendered scene yet.
  const detachedOwner = new THREE.Mesh(sharedGeometry, sharedMaterial);
  const temp = e.temporaryGroup([sharedGeometry, sharedMaterial]);
  temp.add(new THREE.Mesh(ownedGeometry, [ownedMaterial, ownedMaterial]));
  temp.add(new THREE.Mesh(ownedGeometry, ownedMaterial));
  const nested = new THREE.Group();
  nested.add(new THREE.Mesh(sharedGeometry, sharedMaterial));
  temp.add(nested);
  e.clearGroup(temp);
  assert.equal(temp.children.length, 0);
  assert.equal(ownedGeometryCount.value, 1);
  assert.equal(ownedMaterialCount.value, 1);
  assert.equal(sharedGeometryCount.value, 0);
  assert.equal(sharedMaterialCount.value, 0);
  assert.equal(detachedOwner.geometry, sharedGeometry);
  assert.equal(detachedOwner.material, sharedMaterial);
  const next = new THREE.Mesh(sharedGeometry, sharedMaterial);
  temp.add(next);
  e.disposeObject(next);
  assert.equal(sharedGeometryCount.value, 0, 'the temporary group ownership list also applies to individual removal');
  assert.equal(sharedMaterialCount.value, 0);
  e.disposeObject(detachedOwner, [sharedGeometry, sharedMaterial]);
  assert.equal(sharedGeometryCount.value, 0, 'standalone disposal can also declare borrowed resources');
  sharedGeometry.dispose(); sharedMaterial.dispose();
});

test('chapter cleanup clears nested temporary groups and preserves reusable scene objects', async () => {
  const e = await engine();
  const scene = new THREE.Group(), permanent = new THREE.Group();
  const label = e.tag('persistent label', [0, 0, 0]);
  permanent.add(label); scene.add(permanent);
  e.labelState.set(label, { x: 1, y: 1 });
  const side = new THREE.Group(), temp = e.temporaryGroup();
  side.add(temp); scene.add(side);
  for (let i = 0; i < 20; i += 1) {
    const pending = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial());
    const pendingLabel = e.tag('pending', [0, 0, 0]);
    pending.add(pendingLabel); temp.add(pending);
    e.labelState.set(pendingLabel, { x: 1, y: 2 });
    const released = disposals(pending.geometry);
    e.clearTemporary(scene);
    assert.equal(temp.parent, side, 'keep the empty temporary group for a later run');
    assert.equal(permanent.parent, scene);
    assert.equal(e.allTags.size, 1);
    assert.equal(e.labelState.size, 1);
    assert.equal(pendingLabel.element.parentNode, null);
    assert.equal(released.value, 1);
  }
});


test('nested temporary groups preserve descendant ownership guards and release each owned resource once', async () => {
  const e = await engine();
  const sharedGeometry = new THREE.BoxGeometry(), sharedMaterial = new THREE.MeshBasicMaterial();
  const geometryCount = disposals(sharedGeometry), materialCount = disposals(sharedMaterial);
  const scene = new THREE.Group(), outer = e.temporaryGroup(), wrapper = new THREE.Group();
  const inner = e.temporaryGroup([sharedGeometry, sharedMaterial]);
  const borrowed = new THREE.Mesh(sharedGeometry, sharedMaterial);
  inner.add(borrowed); wrapper.add(inner); outer.add(wrapper); scene.add(outer);
  e.clearTemporary(scene);
  assert.equal(outer.children.length, 0);
  assert.equal(geometryCount.value, 0, 'an inner temporary group still declares external ownership');
  assert.equal(materialCount.value, 0);
  const innerOwned = e.temporaryGroup();
  const owned = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial());
  const ownedGeometryCount = disposals(owned.geometry), ownedMaterialCount = disposals(owned.material);
  innerOwned.add(owned); outer.add(innerOwned);
  e.clearTemporary(scene);
  assert.equal(ownedGeometryCount.value, 1, 'nested cleanup must not dispose a subtree twice');
  assert.equal(ownedMaterialCount.value, 1);
  sharedGeometry.dispose(); sharedMaterial.dispose();
});
