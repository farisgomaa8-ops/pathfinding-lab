/** Grid costs are paid when entering a cell. Movement is four-directional. */
export const ALGORITHMS = ["bfs", "dijkstra", "astar"];

export function validateGrid(grid) {
  const { rows, cols, cells, start, goal } = grid;
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(cols) || rows < 1 || cols < 1) {
    throw new RangeError("Grid dimensions must be positive integers.");
  }
  if (!Array.isArray(cells) || cells.length !== rows * cols) {
    throw new RangeError("Cell count must match the grid dimensions.");
  }
  if (Array.from(cells).some(cost => cost !== null && (!Number.isFinite(cost) || cost < 1))) {
    throw new RangeError("Each cell must be a wall (null) or have a finite cost of at least 1.");
  }
  for (const endpoint of [start, goal]) {
    if (!Number.isSafeInteger(endpoint) || endpoint < 0 || endpoint >= cells.length || cells[endpoint] === null) {
      throw new RangeError("Start and goal must identify walkable cells.");
    }
  }
}

export function neighbors(index, rows, cols) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const result = [];
  // Fixed order makes ties and demonstrations reproducible.
  if (col < cols - 1) result.push(index + 1);
  if (row < rows - 1) result.push(index + cols);
  if (col > 0) result.push(index - 1);
  if (row > 0) result.push(index - cols);
  return result;
}

class MinHeap {
  items = [];
  precedes(a, b) { return a.priority < b.priority || (a.priority === b.priority && a.order < b.order); }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (!this.precedes(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const first = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        let best = i;
        if (left < items.length && this.precedes(items[left], items[best])) best = left;
        if (right < items.length && this.precedes(items[right], items[best])) best = right;
        if (best === i) break;
        [items[i], items[best]] = [items[best], items[i]];
        i = best;
      }
    }
    return first;
  }
  get size() { return this.items.length; }
}

/**
 * Returns final path and the order of expanded cells. These are separate so the
 * UI can replay a deterministic search without changing algorithm behavior.
 */
export function search(grid, algorithm = "astar") {
  validateGrid(grid);
  if (!ALGORITHMS.includes(algorithm)) throw new RangeError("Unknown search algorithm.");
  const { rows, cols, cells, start, goal } = grid;
  const distance = Array(cells.length).fill(Infinity);
  const parent = Array(cells.length).fill(-1);
  const expanded = new Set();
  const visited = [];
  const queue = [];
  let head = 0;
  let order = 0;
  const heap = new MinHeap();
  const heuristic = index => Math.abs(Math.floor(index / cols) - Math.floor(goal / cols)) + Math.abs(index % cols - goal % cols);
  distance[start] = 0;
  if (algorithm === "bfs") queue.push(start);
  else heap.push({ index: start, distance: 0, priority: algorithm === "astar" ? heuristic(start) : 0, order: order++ });

  while (algorithm === "bfs" ? head < queue.length : heap.size > 0) {
    const entry = algorithm === "bfs" ? { index: queue[head++] } : heap.pop();
    const current = entry.index;
    if (expanded.has(current) || (algorithm !== "bfs" && entry.distance !== distance[current])) continue;
    expanded.add(current);
    visited.push(current);
    if (current === goal) break;
    for (const next of neighbors(current, rows, cols)) {
      if (cells[next] === null || expanded.has(next)) continue;
      const candidate = distance[current] + (algorithm === "bfs" ? 1 : cells[next]);
      if (candidate >= distance[next]) continue;
      distance[next] = candidate;
      parent[next] = current;
      if (algorithm === "bfs") queue.push(next);
      else heap.push({ index: next, distance: candidate, priority: candidate + (algorithm === "astar" ? heuristic(next) : 0), order: order++ });
    }
  }

  const found = expanded.has(goal);
  const path = [];
  if (found) {
    for (let current = goal; current !== -1; current = parent[current]) path.push(current);
    path.reverse();
  }
  return {
    algorithm, found, visited, path,
    steps: found ? path.length - 1 : null,
    cost: found ? path.slice(1).reduce((sum, index) => sum + cells[index], 0) : null,
  };
}
