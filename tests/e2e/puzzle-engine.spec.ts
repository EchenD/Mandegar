import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { bakedSceneContract } from "../../components/experience/baked-scene-contract";
import { createPuzzleScreenFrame, createPuzzleTableFrame, getPuzzleWorldPoint } from "../../components/experience/composer-puzzle-geometry";
import {
  getPuzzleAdjacentSlot,
  getPuzzleSlotAtPoint,
  getPuzzleSlotCenter,
  isPuzzleSolved,
  isValidPuzzleTiles,
  shufflePuzzleTiles,
  solvedPuzzleTiles,
  swapPuzzleTiles,
} from "../../components/experience/interactions/puzzle-engine";
import {
  activatePuzzleSlot,
  beginPuzzleDrag,
  cancelPuzzleDrag,
  clearPuzzleSelection,
  finishPuzzleDrag,
  getPuzzleState,
  resetPuzzle,
  setPuzzleFocusedSlot,
  setPuzzleInteractive,
  subscribePuzzle,
  updatePuzzleDrag,
} from "../../components/experience/interactions/puzzle-store";
import { getVisitorCreation, savePuzzle } from "../../components/experience/interactions/visitor-creation";

function randomSequence(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function swapSlots(source: number, target: number) {
  activatePuzzleSlot(source);
  activatePuzzleSlot(target);
}

function solvePuzzle() {
  for (let slot = 0; slot < 9; slot += 1) {
    const tiles = getPuzzleState().tiles;
    if (tiles[slot] !== slot) swapSlots(slot, tiles.indexOf(slot));
  }
}

type FixtureGlb = {
  scenes: Array<{ nodes: number[] }>;
  scene: number;
  nodes: Array<{
    name?: string;
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }>;
  meshes: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number }> }>;
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }>;
  bufferViews: Array<{ byteOffset?: number; byteStride?: number }>;
};

/** Read only authored mesh data, so the actual GLB can be checked without images or a browser. */
function createAuthoredPuzzleFixture() {
  const bytes = readFileSync(path.join(process.cwd(), "public/models/mandegar/mandegar_exhibition.glb"));
  const jsonLength = bytes.readUInt32LE(12);
  const fixture = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as FixtureGlb;
  const binaryOffset = 28 + jsonLength;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const itemSizes: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const componentSizes: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
  const readAccessor = (id: number) => {
    const accessor = fixture.accessors[id];
    const view = fixture.bufferViews[accessor.bufferView];
    const itemSize = itemSizes[accessor.type];
    if (!itemSize) throw new Error(`Unsupported fixture accessor ${accessor.type}`);
    const componentBytes = componentSizes[accessor.componentType];
    if (!componentBytes) throw new Error(`Unsupported fixture component ${accessor.componentType}`);
    const values = new Float32Array(accessor.count * itemSize);
    const stride = view.byteStride ?? itemSize * componentBytes;
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let item = 0; item < accessor.count; item += 1) {
      for (let component = 0; component < itemSize; component += 1) {
        const offset = start + item * stride + component * componentBytes;
        values[item * itemSize + component] = accessor.componentType === 5126 ? data.getFloat32(offset, true)
          : accessor.componentType === 5125 ? data.getUint32(offset, true)
            : accessor.componentType === 5123 ? data.getUint16(offset, true) : data.getUint8(offset);
      }
    }
    return new THREE.BufferAttribute(values, itemSize);
  };
  const material = new THREE.MeshBasicMaterial();
  const geometries: THREE.BufferGeometry[] = [];
  const createNode = (id: number): THREE.Object3D => {
    const node = fixture.nodes[id];
    const object = new THREE.Group();
    object.name = node.name ?? "";
    if (node.matrix) {
      object.matrix.fromArray(node.matrix);
      object.matrixAutoUpdate = false;
    } else {
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
    }
    if (node.mesh !== undefined) {
      for (const primitive of fixture.meshes[node.mesh].primitives) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", readAccessor(primitive.attributes.POSITION));
        if (primitive.attributes.TEXCOORD_0 !== undefined) geometry.setAttribute("uv", readAccessor(primitive.attributes.TEXCOORD_0));
        if (primitive.indices !== undefined) geometry.setIndex(Array.from(readAccessor(primitive.indices).array));
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = object.name;
        object.add(mesh);
      }
    }
    for (const child of node.children ?? []) object.add(createNode(child));
    return object;
  };
  const root = new THREE.Group();
  for (const node of fixture.scenes[fixture.scene ?? 0].nodes) root.add(createNode(node));
  root.updateMatrixWorld(true);
  return {
    root,
    dispose: () => { geometries.forEach((geometry) => geometry.dispose()); material.dispose(); },
  };
}

test.beforeEach(() => {
  setPuzzleInteractive(false);
  resetPuzzle(randomSequence(77));
  setPuzzleInteractive(true);
});

test.afterEach(() => {
  setPuzzleInteractive(false);
});

test("shuffles retain every piece, stay unfinished, and change on every reset", () => {
  const random = randomSequence(41);
  let previous: readonly number[] = solvedPuzzleTiles;
  for (let index = 0; index < 250; index += 1) {
    const tiles = shufflePuzzleTiles(random, previous);
    expect(isValidPuzzleTiles(tiles)).toBe(true);
    expect(isPuzzleSolved(tiles)).toBe(false);
    expect(tiles).not.toEqual(previous);
    previous = tiles;
  }
  for (const sample of [0, 1, -100, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const first = shufflePuzzleTiles(() => sample);
    const second = shufflePuzzleTiles(() => sample, first);
    expect(isValidPuzzleTiles(first)).toBe(true);
    expect(isPuzzleSolved(first)).toBe(false);
    expect(isPuzzleSolved(second)).toBe(false);
    expect(second).not.toEqual(first);
  }
});

test("only complete permutations are valid and swaps preserve the original arrangement", () => {
  for (const tiles of [[], [0, 1, 2], [0, 1, 2, 3, 4, 5, 6, 7, 7], [0, 1, 2, 3, 4, 5, 6, 7, 9], Array<number>(9)]) {
    expect(isValidPuzzleTiles(tiles)).toBe(false);
    expect(isPuzzleSolved(tiles)).toBe(false);
  }
  const swapped = swapPuzzleTiles(solvedPuzzleTiles, 0, 8);
  expect(swapped).toEqual([8, 1, 2, 3, 4, 5, 6, 7, 0]);
  expect(solvedPuzzleTiles).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(swapPuzzleTiles(swapped, 0, 8)).toEqual(solvedPuzzleTiles);
  expect(swapPuzzleTiles(swapped, 3, 3)).toBe(swapped);
  expect(swapPuzzleTiles(swapped, -1, 3)).toBe(swapped);
  expect(swapPuzzleTiles(swapped, 3, 9)).toBe(swapped);
});

test("board coordinates and keyboard arrows keep physical left, right, up and down", () => {
  for (let slot = 0; slot < 9; slot += 1) {
    const center = getPuzzleSlotCenter(slot)!;
    expect(getPuzzleSlotAtPoint(center.x, center.y)).toBe(slot);
  }
  expect(getPuzzleSlotAtPoint(0, 0)).toBe(0);
  expect(getPuzzleSlotAtPoint(1, 1)).toBe(8);
  expect(getPuzzleSlotAtPoint(1 / 3, 1 / 3)).toBe(4);
  for (const [x, y] of [[-0.001, 0.5], [0.5, 1.001], [Number.NaN, 0.5], [0.5, Number.POSITIVE_INFINITY]]) {
    expect(getPuzzleSlotAtPoint(x, y)).toBeNull();
  }
  expect(getPuzzleAdjacentSlot(4, "ArrowLeft")).toBe(3);
  expect(getPuzzleAdjacentSlot(4, "ArrowRight")).toBe(5);
  expect(getPuzzleAdjacentSlot(4, "ArrowUp")).toBe(1);
  expect(getPuzzleAdjacentSlot(4, "ArrowDown")).toBe(7);
  expect(getPuzzleAdjacentSlot(0, "ArrowLeft")).toBe(0);
  expect(getPuzzleAdjacentSlot(2, "ArrowRight")).toBe(2);
  expect(getPuzzleAdjacentSlot(0, "ArrowUp")).toBe(0);
  expect(getPuzzleAdjacentSlot(8, "ArrowDown")).toBe(8);
});

test("every solved tile corner lies on the real authored counter without changing its geometry", () => {
  const fixture = createAuthoredPuzzleFixture();
  try {
    const meshes: THREE.Mesh[] = [];
    const matrices = new Map<THREE.Object3D, THREE.Matrix4>();
    fixture.root.traverse((object) => {
      matrices.set(object, object.matrixWorld.clone());
      if (object instanceof THREE.Mesh && object.name === "left_architecture_") meshes.push(object);
    });
    const screen = fixture.root.getObjectByName(bakedSceneContract.exhibition.screens.interactive)!;
    const screenFrame = createPuzzleScreenFrame(screen)!;
    const frame = createPuzzleTableFrame(fixture.root, screenFrame)!;
    expect(frame).not.toBeNull();
    expect(frame.cornersFit).toBe(true);
    expect(frame.width / frame.height).toBeCloseTo(1.5);
    expect(frame.width).toBeGreaterThanOrEqual(0.3);
    expect(frame.normal.y).toBeGreaterThan(0.85);
    const ray = new THREE.Raycaster();
    for (let slot = 0; slot < 9; slot += 1) {
      for (const dx of [0, 1]) {
        for (const dy of [0, 1]) {
          const corner = getPuzzleWorldPoint(frame, ((slot % 3) + dx) / 3, (Math.floor(slot / 3) + dy) / 3, new THREE.Vector3(), 0);
          ray.set(corner.clone().addScaledVector(frame.normal, 0.2), frame.normal.clone().negate());
          const hit = ray.intersectObjects(meshes, false)[0];
          expect(hit, `authored counter under slot ${slot} corner ${dx},${dy}`).toBeDefined();
          expect(hit.point.distanceTo(corner)).toBeLessThan(0.0001);
        }
      }
    }
    for (const [object, matrix] of matrices) expect(object.matrixWorld.equals(matrix)).toBe(true);
  } finally {
    fixture.dispose();
  }
});

test("a tap selects one slot, a second tap commits exactly one swap, and deselection has no move", () => {
  const before = getPuzzleState().tiles;
  activatePuzzleSlot(2);
  expect(getPuzzleState()).toMatchObject({ selectedSlot: 2, started: true, moves: 0 });
  expect(getVisitorCreation().puzzle).toEqual({ tiles: before, started: true, moves: 0 });
  activatePuzzleSlot(2);
  expect(getPuzzleState()).toMatchObject({ selectedSlot: null, moves: 0 });
  activatePuzzleSlot(2);
  activatePuzzleSlot(7);
  expect(getPuzzleState().tiles).toEqual(swapPuzzleTiles(before, 2, 7));
  expect(getPuzzleState()).toMatchObject({ selectedSlot: null, moves: 1 });
  expect(getVisitorCreation().puzzle.tiles).toEqual(getPuzzleState().tiles);
});

test("one pointer owns the drag and unrelated gestures cannot move, finish or cancel it", () => {
  const point = getPuzzleSlotCenter(0)!;
  expect(beginPuzzleDrag(0, 71, point.x, point.y, "table")).toBe(true);
  const owned = getPuzzleState();
  expect(owned.dragging?.surface).toBe("table");
  expect(beginPuzzleDrag(1, 72, 0.5, 0.1)).toBe(false);
  updatePuzzleDrag(72, 0.5, 0.5);
  finishPuzzleDrag(72);
  cancelPuzzleDrag(72);
  activatePuzzleSlot(1);
  expect(getPuzzleState()).toBe(owned);
  updatePuzzleDrag(71, Number.NaN, 0.5);
  updatePuzzleDrag(71, 0.5, Number.POSITIVE_INFINITY);
  expect(getPuzzleState()).toBe(owned);
  cancelPuzzleDrag(71);
  expect(getPuzzleState().dragging).toBeNull();
});

test("the cached drag preview is shared while only a release persists its candidate swap", () => {
  const before = getPuzzleState().tiles;
  const saved = getVisitorCreation().puzzle;
  const start = getPuzzleSlotCenter(0)!;
  const target = getPuzzleSlotCenter(8)!;
  beginPuzzleDrag(0, 1, start.x, start.y);
  updatePuzzleDrag(1, target.x, target.y);
  const preview = getPuzzleState().previewTiles;
  expect(preview).toEqual(swapPuzzleTiles(before, 0, 8));
  expect(getPuzzleState().tiles).toBe(before);
  expect(getPuzzleState()).toMatchObject({ started: false, moves: 0 });
  expect(getVisitorCreation().puzzle).toBe(saved);
  updatePuzzleDrag(1, target.x + 0.01, target.y + 0.01);
  expect(getPuzzleState().previewTiles).toBe(preview);
  finishPuzzleDrag(1);
  expect(getPuzzleState().tiles).toEqual(preview);
  expect(getPuzzleState().previewTiles).toBe(getPuzzleState().tiles);
  expect(getPuzzleState()).toMatchObject({ dragging: null, moves: 1, started: true });
  expect(getVisitorCreation().puzzle).toEqual({ tiles: preview, moves: 1, started: true });
});

test("off-board releases and cancellation preserve the committed arrangement and saved progress", () => {
  swapSlots(0, 4);
  const before = getPuzzleState().tiles;
  const saved = getVisitorCreation().puzzle;
  const start = getPuzzleSlotCenter(2)!;
  const target = getPuzzleSlotCenter(6)!;
  beginPuzzleDrag(2, 4, start.x, start.y);
  updatePuzzleDrag(4, target.x, target.y);
  updatePuzzleDrag(4, -0.1, 0.5);
  expect(getPuzzleState().dragging?.targetSlot).toBeNull();
  expect(getPuzzleState().previewTiles).toBe(before);
  finishPuzzleDrag(4);
  expect(getPuzzleState().tiles).toBe(before);
  expect(getVisitorCreation().puzzle).toBe(saved);
  beginPuzzleDrag(2, 5, start.x, start.y);
  updatePuzzleDrag(5, target.x, target.y);
  cancelPuzzleDrag();
  expect(getPuzzleState().tiles).toBe(before);
  expect(getPuzzleState().previewTiles).toBe(before);
  expect(getVisitorCreation().puzzle).toBe(saved);
});

test("an unmoved pointer release follows the same two-tap selection as keyboard activation", () => {
  const before = getPuzzleState().tiles;
  const first = getPuzzleSlotCenter(1)!;
  const second = getPuzzleSlotCenter(5)!;
  beginPuzzleDrag(1, 7, first.x, first.y, "semantic");
  updatePuzzleDrag(7, first.x + 0.005, first.y);
  finishPuzzleDrag(7);
  expect(getPuzzleState()).toMatchObject({ selectedSlot: 1, moves: 0 });
  beginPuzzleDrag(5, 8, second.x, second.y);
  finishPuzzleDrag(8);
  expect(getPuzzleState().tiles).toEqual(swapPuzzleTiles(before, 1, 5));
  expect(getPuzzleState()).toMatchObject({ selectedSlot: null, moves: 1 });
});

test("a solved preview remains unfinished until its last swap commits", () => {
  let tiles = getPuzzleState().tiles;
  while (tiles.filter((piece, slot) => piece !== slot).length > 2) {
    const source = tiles.findIndex((piece, slot) => piece !== slot);
    swapSlots(source, tiles.indexOf(source));
    tiles = getPuzzleState().tiles;
  }
  const source = tiles.findIndex((piece, slot) => piece !== slot);
  const target = tiles.indexOf(source);
  const startPoint = getPuzzleSlotCenter(source)!;
  const targetPoint = getPuzzleSlotCenter(target)!;
  const moves = getPuzzleState().moves;
  beginPuzzleDrag(source, 91, startPoint.x, startPoint.y);
  updatePuzzleDrag(91, targetPoint.x, targetPoint.y);
  expect(isPuzzleSolved(getPuzzleState().previewTiles)).toBe(true);
  expect(getPuzzleState()).toMatchObject({ solved: false, moves });
  expect(isPuzzleSolved(getVisitorCreation().puzzle.tiles)).toBe(false);
  cancelPuzzleDrag(91);
  expect(getPuzzleState().solved).toBe(false);
  beginPuzzleDrag(source, 92, startPoint.x, startPoint.y);
  updatePuzzleDrag(92, targetPoint.x, targetPoint.y);
  finishPuzzleDrag(92);
  expect(getPuzzleState()).toMatchObject({ solved: true, moves: moves + 1, dragging: null });
  expect(getPuzzleState().tiles).toEqual(solvedPuzzleTiles);
  expect(getVisitorCreation().puzzle.tiles).toEqual(solvedPuzzleTiles);
});

test("closing releases transient interaction and reopening keeps partial and solved progress", () => {
  swapSlots(0, 3);
  const partial = getPuzzleState().tiles;
  const moves = getPuzzleState().moves;
  activatePuzzleSlot(5);
  setPuzzleFocusedSlot(5);
  const point = getPuzzleSlotCenter(1)!;
  beginPuzzleDrag(1, 3, point.x, point.y);
  updatePuzzleDrag(3, 0.8, 0.8);
  setPuzzleInteractive(false);
  expect(getPuzzleState()).toMatchObject({ tiles: partial, moves, selectedSlot: null, focusedSlot: null, dragging: null });
  expect(getPuzzleState().previewTiles).toBe(partial);
  expect(beginPuzzleDrag(1, 4, point.x, point.y)).toBe(false);
  activatePuzzleSlot(1);
  expect(getPuzzleState().selectedSlot).toBeNull();
  setPuzzleInteractive(true);
  solvePuzzle();
  const completed = getPuzzleState();
  setPuzzleInteractive(false);
  setPuzzleInteractive(true);
  expect(getPuzzleState()).toMatchObject({ tiles: solvedPuzzleTiles, moves: completed.moves, solved: true });
  activatePuzzleSlot(0);
  expect(beginPuzzleDrag(0, 5, point.x, point.y)).toBe(false);
  expect(getPuzzleState().tiles).toEqual(solvedPuzzleTiles);
});

test("reset clears completion, counters and pending gestures and saves a fresh unfinished board", () => {
  solvePuzzle();
  expect(getPuzzleState().solved).toBe(true);
  resetPuzzle();
  const firstReset = getPuzzleState().tiles;
  expect(getPuzzleState()).toMatchObject({ solved: false, started: false, moves: 0, selectedSlot: null, focusedSlot: null, dragging: null });
  expect(getVisitorCreation().puzzle).toEqual({ tiles: firstReset, moves: 0, started: false });
  activatePuzzleSlot(0);
  setPuzzleFocusedSlot(0);
  const point = getPuzzleSlotCenter(2)!;
  beginPuzzleDrag(2, 10, point.x, point.y);
  updatePuzzleDrag(10, 0.5, 0.5);
  resetPuzzle();
  expect(getPuzzleState().tiles).not.toEqual(firstReset);
  expect(isValidPuzzleTiles(getPuzzleState().tiles)).toBe(true);
  expect(getPuzzleState()).toMatchObject({ solved: false, started: false, moves: 0, selectedSlot: null, focusedSlot: null, dragging: null });
  finishPuzzleDrag(10);
  expect(getPuzzleState().moves).toBe(0);
});

test("transient selection and focus do not write progress and subscriptions stop after cleanup", () => {
  const lighting = getVisitorCreation().lighting;
  const gameBest = getVisitorCreation().gameBest;
  activatePuzzleSlot(0);
  const saved = getVisitorCreation().puzzle;
  let notifications = 0;
  const unsubscribe = subscribePuzzle(() => { notifications += 1; });
  setPuzzleFocusedSlot(3);
  clearPuzzleSelection();
  expect(notifications).toBe(2);
  expect(getVisitorCreation().puzzle).toBe(saved);
  const snapshot = getPuzzleState();
  setPuzzleFocusedSlot(3);
  activatePuzzleSlot(-1);
  expect(getPuzzleState()).toBe(snapshot);
  unsubscribe();
  setPuzzleFocusedSlot(null);
  expect(notifications).toBe(2);
  expect(getVisitorCreation().lighting).toBe(lighting);
  expect(getVisitorCreation().gameBest).toBe(gameBest);
  expect(savePuzzle({ tiles: [0, 0], moves: 0, started: false })).toBe(false);
  expect(savePuzzle({ tiles: solvedPuzzleTiles, moves: Number.NaN, started: true })).toBe(false);
  expect(getVisitorCreation().puzzle).toBe(saved);
});
