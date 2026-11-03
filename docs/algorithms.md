# How the searches work

## The graph model

Each walkable cell is a vertex. Orthogonal neighbors form directed edges, where the edge cost equals the destination cell’s terrain cost. Although two neighboring cells are connected in both directions, their movement costs can differ if their terrain differs.

The API accepts an object with `rows`, `cols`, `cells`, `start`, and `goal`. `cells` is a row-major array. A wall is `null`; every walkable cell has a finite numeric cost of at least one. Endpoints must be walkable. The start and goal may identify the same cell.

The return value contains:

- `found`: whether the goal was reached.
- `visited`: cells in expansion order, without duplicates.
- `path`: start-to-goal cells, or an empty array when unreachable.
- `steps`: number of edges in the path, or `null` when unreachable.
- `cost`: sum of destination-cell costs, or `null` when unreachable.

With equal endpoints, the path contains one cell, steps and cost are zero, and exactly one cell is expanded.

## Breadth-first search

BFS uses a queue, treating every edge as cost one. It discovers paths by increasing edge count. A cell is enqueued only when its distance improves; on this unit-cost search that happens at most once. The array queue uses a moving head index rather than `shift()`, avoiding repeated array compaction.

BFS minimizes steps, not weighted cost. Its reported `cost` is computed after reconstructing the chosen path, using the real terrain values. This distinction is deliberate and is visible on the default marsh map.

Time and storage are O(V + E) and O(V), respectively. On a four-neighbor grid, E is O(V).

## Dijkstra

Dijkstra orders a binary min-heap by the best known cost from the start, `g(n)`. A newly discovered cheaper route updates the predecessor and distance. The heap uses duplicate entries instead of a decrease-key operation; obsolete entries are skipped when popped.

All allowed edge costs are positive, so a cell’s best distance is final when expanded. The search stops when the goal is expanded, not when the goal is first discovered. This distinction prevents a premature, more expensive result.

The implementation costs O((V + E) log V) time and O(V + E) storage in the worst case; both simplify on a fixed-degree grid.

## A*

A* uses the same heap and relaxation logic as Dijkstra, but prioritizes `g(n) + h(n)`. Its heuristic is Manhattan distance:

```text
h(n) = abs(n.row - goal.row) + abs(n.col - goal.col)
```

Every move crosses one orthogonal edge and costs at least one. Manhattan distance therefore never overestimates the remaining travel cost. It is also consistent: a neighbor changes Manhattan distance by at most one, and that edge costs at least one. With these assumptions, a cell does not need reopening after expansion, and the first expanded goal has optimal cost.

Do not add diagonal movement or costs below one without revisiting this heuristic and the algorithm’s assumptions. A* has the same worst-case bound as this Dijkstra implementation. It is not guaranteed to visit fewer cells on every map.

## Reproducibility

Neighbors are considered right, down, left, then up. Heap entries with equal priority are ordered by insertion sequence. This gives stable visit traces and paths for a given input. Several different routes can be equally optimal; this implementation returns one of them.

For the default marsh map:

```text
BFS       207 expanded cells   17 steps   cost 49
Dijkstra  249 expanded cells   23 steps   cost 23
A*         74 expanded cells   23 steps   cost 23
```

These are deterministic counts, not timing benchmarks. Interface painting and animation are separate from the algorithm calculation.

## Playback and editing

The pure search function computes a complete trace. The browser replays that trace with `requestAnimationFrame`, revealing expanded cells over time. Single-step advances by one expansion. The final route appears when replay completes.

Editing the map cancels playback and discards the trace and comparisons. This prevents old results from being shown as if they describe the new graph. Pausing preserves the current trace. A comparison runs all three searches against the same unmodified map.

## Verification

The tests use specific examples and an independent repeated-relaxation oracle on 80 reproducibly generated weighted grids. The oracle intentionally avoids the production heap implementation. Each returned path is also checked for valid neighbors, walkable cells, endpoints, and cost arithmetic.

This is stronger than checking only that A* and Dijkstra agree, since two implementations sharing the same bug could agree on an incorrect answer. It remains a finite test suite, not a formal proof.
