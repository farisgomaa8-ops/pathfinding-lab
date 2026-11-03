import test from "node:test";
import assert from "node:assert/strict";
import { search, neighbors, ALGORITHMS } from "../src/algorithms.js";
import { createPreset } from "../src/presets.js";

const make = (rows, cols, cells, start = 0, goal = rows * cols - 1) => ({ rows, cols, cells, start, goal });
const all = callback => ALGORITHMS.forEach(callback);

function assertValidPath(grid, result) {
  assert.equal(new Set(result.visited).size, result.visited.length, "expands each cell at most once");
  assert.ok(result.visited.every(index => grid.cells[index] !== null));
  if (!result.found) { assert.deepEqual(result.path, []); assert.equal(result.cost, null); return; }
  assert.equal(result.path[0], grid.start);
  assert.equal(result.path.at(-1), grid.goal);
  let cost = 0;
  for (let i = 1; i < result.path.length; i++) {
    assert.ok(neighbors(result.path[i - 1], grid.rows, grid.cols).includes(result.path[i]));
    assert.notEqual(grid.cells[result.path[i]], null);
    cost += grid.cells[result.path[i]];
  }
  assert.equal(result.cost, cost);
  assert.equal(result.steps, result.path.length - 1);
}

test("neighbors never wrap across row boundaries", () => {
  assert.deepEqual(neighbors(2, 2, 3), [5, 1]);
  assert.deepEqual(neighbors(3, 2, 3), [4, 0]);
  assert.deepEqual(neighbors(0, 1, 1), []);
});
test("open grids give shortest valid routes", () => all(algorithm => {
  const grid = make(3, 4, Array(12).fill(1));
  const result = search(grid, algorithm);
  assert.equal(result.cost, 5);
  assert.equal(result.steps, 5);
  assertValidPath(grid, result);
}));
test("BFS minimizes steps while weighted algorithms minimize cost", () => {
  const grid = make(2, 4, [1, 5, 5, 1, 1, 1, 1, 1], 0, 3);
  const bfs = search(grid, "bfs");
  assert.equal(bfs.steps, 3);
  assert.equal(bfs.cost, 11);
  for (const algorithm of ["dijkstra", "astar"]) {
    const result = search(grid, algorithm);
    assert.equal(result.steps, 5);
    assert.equal(result.cost, 5);
    assertValidPath(grid, result);
  }
});
test("an isolated goal returns no fabricated route", () => all(algorithm => {
  const grid = make(3, 3, [1, 1, 1, null, null, null, 1, 1, 1]);
  const result = search(grid, algorithm);
  assert.equal(result.found, false);
  assert.equal(result.steps, null);
  assert.equal(result.visited.length, 3);
  assertValidPath(grid, result);
}));
test("start equals goal has zero travel cost and no steps", () => all(algorithm => {
  const result = search(make(1, 1, [5]), algorithm);
  assert.deepEqual(result.path, [0]);
  assert.deepEqual(result.visited, [0]);
  assert.equal(result.cost, 0);
  assert.equal(result.steps, 0);
}));
test("cost belongs to the destination cell, including the goal", () => {
  assert.equal(search(make(1, 3, [9, 2, 7]), "astar").cost, 9);
});
test("fractional costs of at least one remain valid", () => {
  assert.equal(search(make(1, 3, [1, 1.5, 2.5]), "astar").cost, 4);
});
test("invalid dimensions, cells, endpoints and algorithms are rejected", () => {
  const base = make(2, 2, [1, 1, 1, 1]);
  for (const change of [{ rows: 0 }, { cols: 2.5 }, { cells: [1] }, { cells: [1, 0, 1, 1] }, { cells: [1, Infinity, 1, 1] }, { cells: [1, NaN, 1, 1] }, { cells: [1, "1", 1, 1] }, { start: -1 }, { goal: 4 }, { start: 1.5 }, { cells: [null, 1, 1, 1] }]) {
    assert.throws(() => search({ ...base, ...change }), RangeError);
  }
  assert.throws(() => search(base, "greedy"), RangeError);
  assert.throws(() => search({ ...base, cells: Array(4) }), RangeError);
});
test("all presets are deterministic and produce valid results", () => {
  for (const preset of ["terrain", "maze", "open", "blocked"]) {
    const grid = createPreset(preset);
    assert.deepEqual(grid, createPreset(preset));
    all(algorithm => {
      const first = search(grid, algorithm);
      assert.deepEqual(first, search(grid, algorithm));
      assertValidPath(grid, first);
      assert.equal(first.found, preset !== "blocked");
    });
  }
});
test("the default map demonstrates the tradeoff between steps and cost", () => {
  const grid = createPreset();
  const bfs = search(grid, "bfs");
  const dijkstra = search(grid, "dijkstra");
  assert.ok(bfs.steps < dijkstra.steps);
  assert.ok(bfs.cost > dijkstra.cost);
});
test("search does not mutate the supplied map", () => {
  const grid = createPreset();
  const original = structuredClone(grid);
  all(algorithm => search(grid, algorithm));
  assert.deepEqual(grid, original);
});

// An independent repeated-relaxation oracle, intentionally not heap-based.
function referenceCost(grid) {
  const distance = Array(grid.cells.length).fill(Infinity);
  distance[grid.start] = 0;
  for (let pass = 0; pass < grid.cells.length; pass++) {
    let changed = false;
    for (let current = 0; current < grid.cells.length; current++) {
      if (grid.cells[current] === null) continue;
      for (const next of neighbors(current, grid.rows, grid.cols)) {
        if (grid.cells[next] === null) continue;
        const cost = distance[current] + grid.cells[next];
        if (cost < distance[next]) { distance[next] = cost; changed = true; }
      }
    }
    if (!changed) break;
  }
  return Number.isFinite(distance[grid.goal]) ? distance[grid.goal] : null;
}

test("Dijkstra and A* match an independent oracle on 80 seeded weighted grids", () => {
  let seed = 817;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let sample = 0; sample < 80; sample++) {
    const cells = Array.from({ length: 30 }, () => { const r = random(); return r < .23 ? null : r < .60 ? 5 : 1; });
    cells[0] = cells[29] = 1;
    const grid = make(5, 6, cells);
    const expected = referenceCost(grid);
    for (const algorithm of ["dijkstra", "astar"]) {
      const result = search(grid, algorithm);
      assert.equal(result.cost, expected, `sample ${sample}, ${algorithm}`);
      assertValidPath(grid, result);
    }
    const bfs = search(grid, "bfs");
    const unweighted = { ...grid, cells: cells.map(cost => cost === null ? null : 1) };
    assert.equal(bfs.steps, referenceCost(unweighted));
    assertValidPath(grid, bfs);
  }
});
