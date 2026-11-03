export const ROWS = 14;
export const COLS = 22;

export function createPreset(name = "terrain") {
  const rows = ROWS;
  const cols = COLS;
  const at = (row, col) => row * cols + col;
  const cells = Array(rows * cols).fill(1);
  const start = at(7, 2);
  const goal = at(7, 19);
  if (name === "terrain") {
    for (let r = 5; r <= 9; r++) for (let c = 7; c <= 14; c++) cells[at(r, c)] = 5;
    for (let r = 1; r <= 11; r++) if (r !== 4 && r !== 7) cells[at(r, 5)] = null;
    for (let r = 3; r <= 12; r++) if (r !== 7 && r !== 11) cells[at(r, 17)] = null;
  } else if (name === "maze") {
    for (const [col, gap] of [[5, 3], [10, 10], [15, 3]]) {
      for (let r = 0; r < rows; r++) if (r !== gap) cells[at(r, col)] = null;
    }
  } else if (name === "blocked") {
    for (let r = 0; r < rows; r++) cells[at(r, 11)] = null;
  } else if (name !== "open") throw new RangeError("Unknown preset.");
  return { rows, cols, cells, start, goal };
}
