import { search, ALGORITHMS } from "./algorithms.js";
import { createPreset } from "./presets.js";

const $ = id => document.getElementById(id);
const names = { bfs: "Breadth-first search", dijkstra: "Dijkstra", astar: "A* search" };
const descriptions = {
  bfs: "Finds the fewest steps. Terrain costs do not influence its route, so the trip may cost more.",
  dijkstra: "Explores the cheapest known route next. Finds the lowest-cost route.",
  astar: "Uses distance to the goal to guide the search. Finds the lowest-cost route.",
};
let grid = createPreset();
let tool = "wall";
let drawing = false;
let lastPainted = -1;
let focused = grid.start;
let result = null;
let cursor = 0;
let running = false;
let frame = null;
let lastTime = 0;
let accumulated = 0;
let shown = new Set();
let cells = [];
let comparisons = null;

function cellDescription(index) {
  const location = `Row ${Math.floor(index / grid.cols) + 1}, column ${index % grid.cols + 1}`;
  const terrain = grid.cells[index] === null ? "wall" : `cost ${grid.cells[index]}`;
  return `${location}, ${terrain}${index === grid.start ? ", start" : ""}${index === grid.goal ? ", goal" : ""}`;
}

function createGrid() {
  $("grid").replaceChildren();
  $("grid").setAttribute("aria-rowcount", grid.rows);
  $("grid").setAttribute("aria-colcount", grid.cols);
  cells = [];
  for (let row = 0; row < grid.rows; row++) {
    const rowElement = document.createElement("div");
    rowElement.setAttribute("role", "row");
    rowElement.style.display = "contents";
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = index;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-colindex", col + 1);
      cell.setAttribute("aria-rowindex", row + 1);
      cell.tabIndex = index === focused ? 0 : -1;
      rowElement.append(cell);
      cells.push(cell);
    }
    $("grid").append(rowElement);
  }
  render();
}

function render() {
  const complete = result && cursor === result.visited.length;
  const route = new Set(complete ? result.path : []);
  for (let index = 0; index < grid.cells.length; index++) {
    const cost = grid.cells[index];
    const cell = cells[index];
    cell.className = "cell";
    if (cost === null) cell.classList.add("wall");
    else if (cost > 1) cell.classList.add("terrain");
    if (shown.has(index)) cell.classList.add("explored");
    if (route.has(index)) cell.classList.add("route");
    if (index === grid.start) cell.classList.add("start");
    if (index === grid.goal) cell.classList.add("goal");
    cell.textContent = index === grid.start && index === grid.goal ? "S/G" : index === grid.start ? "S" : index === grid.goal ? "G" : cost > 1 ? cost : "";
    cell.setAttribute("aria-label", cellDescription(index));
  }
  $("visited").textContent = cursor;
  $("steps").textContent = complete && result.found ? result.steps : "—";
  $("cost").textContent = complete && result.found ? result.cost : "—";
  $("run").textContent = running ? "Pause" : complete ? "Run again" : cursor ? "Continue" : "Run search";
  $("step").disabled = running || Boolean(complete);
  if (complete) {
    $("status").textContent = result.found
      ? `${names[result.algorithm]} found a route.${result.algorithm === "bfs" ? " This minimizes steps, not terrain cost." : " This is a lowest-cost route."}`
      : "No route reaches the goal. Erase a wall or move an endpoint to try again.";
  }
}

function pause() {
  running = false;
  cancelAnimationFrame(frame);
  frame = null;
  if (result && cursor < result.visited.length) $("status").textContent = "Paused. Continue the search or inspect it one step at a time.";
  render();
}

function resetTrace(message = "Ready. Choose an algorithm and run a search.") {
  running = false;
  cancelAnimationFrame(frame);
  frame = null;
  result = null;
  cursor = 0;
  shown = new Set();
  accumulated = 0;
  $("status").textContent = message;
  render();
}

function invalidateComparison() {
  comparisons = null;
  $("comparison-results").replaceChildren();
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = "Run “Compare all three” to see the results for this map.";
  $("comparison-results").append(note);
}

function ensureSearch() {
  if (!result) result = search(grid, $("algorithm").value);
}

function advance() {
  ensureSearch();
  if (cursor < result.visited.length) shown.add(result.visited[cursor++]);
  if (cursor === result.visited.length) running = false;
}

function tick(time) {
  if (!running) return;
  accumulated += Math.min(time - lastTime, 150);
  lastTime = time;
  const interval = 202 - Number($("speed").value) * 2;
  while (accumulated >= interval && running) {
    advance();
    accumulated -= interval;
  }
  render();
  if (running) frame = requestAnimationFrame(tick);
}

$("run").addEventListener("click", () => {
  if (running) return pause();
  if (result && cursor === result.visited.length) resetTrace();
  ensureSearch();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cursor = result.visited.length;
    shown = new Set(result.visited);
    render();
    return;
  }
  running = true;
  lastTime = performance.now();
  accumulated = 0;
  $("status").textContent = "Searching. Pause to inspect the explored cells.";
  render();
  frame = requestAnimationFrame(tick);
});
$("step").addEventListener("click", () => {
  advance();
  $("status").textContent = "Showing one more expanded cell. Step again or continue the search.";
  render();
});
$("reset").addEventListener("click", () => resetTrace());
$("algorithm").addEventListener("change", () => {
  resetTrace();
  $("algorithm-note").textContent = descriptions[$("algorithm").value];
  if (comparisons) showComparison(comparisons);
});
$("preset").addEventListener("change", () => {
  grid = createPreset($("preset").value);
  focused = grid.start;
  $("map-title").textContent = $("preset").selectedOptions[0].textContent;
  createGrid();
  resetTrace();
  invalidateComparison();
});
document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
  tool = button.dataset.tool;
  document.querySelectorAll("[data-tool]").forEach(other => other.setAttribute("aria-pressed", other === button));
}));

function paint(index) {
  if (index === lastPainted) return;
  lastPainted = index;
  if (tool === "start" || tool === "goal") {
    grid[tool] = index;
    grid.cells[index] = 1;
  } else if (index !== grid.start && index !== grid.goal) {
    grid.cells[index] = tool === "wall" ? null : tool === "terrain" ? 5 : 1;
  } else return;
  resetTrace("Map edited. Run a new search to explore this layout.");
  invalidateComparison();
  $("map-title").textContent = "Your custom map";
}

function focusCell(index, moveFocus = true) {
  cells[focused].tabIndex = -1;
  focused = index;
  cells[focused].tabIndex = 0;
  if (moveFocus) cells[focused].focus({ preventScroll: true });
}

$("grid").addEventListener("pointerdown", event => {
  const cell = event.target.closest("[data-index]");
  if (!cell || event.button !== 0) return;
  event.preventDefault();
  drawing = true;
  lastPainted = -1;
  focusCell(Number(cell.dataset.index));
  paint(Number(cell.dataset.index));
});
$("grid").addEventListener("pointerover", event => {
  const cell = event.target.closest("[data-index]");
  if (drawing && cell) paint(Number(cell.dataset.index));
});
$("grid").addEventListener("pointermove", event => {
  if (!drawing || event.pointerType === "mouse") return;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-index]");
  if (cell && $("grid").contains(cell)) paint(Number(cell.dataset.index));
});
window.addEventListener("pointerup", () => { drawing = false; lastPainted = -1; });
window.addEventListener("pointercancel", () => { drawing = false; lastPainted = -1; });
window.addEventListener("blur", () => { drawing = false; lastPainted = -1; if (running) pause(); });
$("grid").addEventListener("click", event => {
  const cell = event.target.closest("[data-index]");
  // Keyboard activation fires click with detail=0; pointer painting happens above.
  if (cell && event.detail === 0) { lastPainted = -1; paint(Number(cell.dataset.index)); }
});
$("grid").addEventListener("keydown", event => {
  const row = Math.floor(focused / grid.cols);
  const col = focused % grid.cols;
  const offsets = { ArrowRight: col < grid.cols - 1 ? 1 : 0, ArrowLeft: col > 0 ? -1 : 0, ArrowDown: row < grid.rows - 1 ? grid.cols : 0, ArrowUp: row > 0 ? -grid.cols : 0, Home: -col, End: grid.cols - 1 - col };
  if (event.key in offsets) {
    event.preventDefault();
    focusCell(focused + offsets[event.key]);
    cells[focused].scrollIntoView({ block: "nearest", inline: "nearest" });
  }
});

function showComparison(results) {
  const maximum = Math.max(...results.map(item => item.visited.length), 1);
  const container = $("comparison-results");
  container.replaceChildren();
  for (const item of results) {
    const row = document.createElement("div");
    row.className = `result-row${item.algorithm === $("algorithm").value ? " selected" : ""}`;
    const title = document.createElement("div");
    title.className = "result-label";
    title.textContent = names[item.algorithm];
    const detail = document.createElement("small");
    detail.textContent = item.found ? item.algorithm === "bfs" ? "Fewest steps" : "Lowest cost" : "No route";
    title.append(detail);
    const track = document.createElement("div");
    track.className = "bar-track";
    track.setAttribute("aria-hidden", "true");
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = `${item.visited.length / maximum * 100}%`;
    track.append(bar);
    row.append(title, track);
    for (const [value, label] of [[item.visited.length, "explored"], [item.steps ?? "—", "steps"], [item.cost ?? "—", "cost"]]) {
      const metric = document.createElement("div");
      metric.className = "metric";
      metric.textContent = value;
      const caption = document.createElement("small");
      caption.textContent = label;
      metric.append(caption);
      row.append(metric);
    }
    container.append(row);
  }
}

$("compare").addEventListener("click", () => {
  pause();
  comparisons = ALGORITHMS.map(algorithm => search(grid, algorithm));
  showComparison(comparisons);
  result = comparisons.find(item => item.algorithm === $("algorithm").value);
  cursor = result.visited.length;
  shown = new Set(result.visited);
  render();
});

createGrid();
