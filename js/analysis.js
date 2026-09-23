// Board analysis shared by rendering and, later, computer agents.

import { N, CellType, cellKey, neighbors4, ownerAndValue } from "./game.js";

export function getComponents(game) {
  const visited = Array.from({ length: N }, () => Array(N).fill(false));
  const components = [];

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (visited[r][c]) continue;

      const [player] = ownerAndValue(game.board[r][c]);
      if (player === null) continue;

      const queue = [[r, c]];
      const cells = [];
      let sum = 0;
      visited[r][c] = true;

      while (queue.length) {
        const [cr, cc] = queue.shift();
        cells.push([cr, cc]);
        const [, value] = ownerAndValue(game.board[cr][cc]);
        sum += value;

        for (const [nr, nc] of neighbors4(cr, cc)) {
          if (visited[nr][nc]) continue;
          const [neighborPlayer] = ownerAndValue(game.board[nr][nc]);
          if (neighborPlayer === player) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }

      components.push({ player, cells, size: cells.length, sum });
    }
  }

  return components;
}

export function selectLCC(components, player) {
  const candidates = components
    .filter((component) => component.player === player)
    .sort((a, b) => (b.size !== a.size ? b.size - a.size : b.sum - a.sum));

  if (!candidates.length) {
    return { score: 0, size: 0, highlight: new Set(), cells: [] };
  }

  const best = candidates[0];
  return {
    score: best.sum,
    size: best.size,
    highlight: new Set(best.cells.map(([r, c]) => cellKey(r, c))),
    cells: best.cells,
  };
}

export function computeLCC(game, player, components = null) {
  return selectLCC(components ?? getComponents(game), player);
}

export function computeComponentInfo(game, components = null) {
  const scores = new Map();
  const labels = new Set();

  for (const component of components ?? getComponents(game)) {
    for (const [r, c] of component.cells) {
      scores.set(cellKey(r, c), component.sum);
    }

    let rowSum = 0;
    let colSum = 0;
    for (const [r, c] of component.cells) {
      rowSum += r;
      colSum += c;
    }

    const centroidRow = rowSum / component.cells.length;
    const centroidCol = colSum / component.cells.length;
    let labelCell = component.cells[0];
    let bestDistance = Infinity;

    for (const [r, c] of component.cells) {
      const dr = r - centroidRow;
      const dc = c - centroidCol;
      const distance = dr * dr + dc * dc;
      if (distance < bestDistance) {
        bestDistance = distance;
        labelCell = [r, c];
      }
    }

    labels.add(cellKey(labelCell[0], labelCell[1]));
  }

  return { scores, labels };
}

export function sameOwner(game, r1, c1, r2, c2) {
  if (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N) return false;
  const [owner1] = ownerAndValue(game.board[r1][c1]);
  const [owner2] = ownerAndValue(game.board[r2][c2]);
  return owner1 !== null && owner1 === owner2;
}

export function liberty(game, player) {
  const openCells = new Set();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const [owner] = ownerAndValue(game.board[r][c]);
      if (owner !== player) continue;
      for (const [nr, nc] of neighbors4(r, c)) {
        if (game.board[nr][nc] === CellType.EMPTY) {
          openCells.add(cellKey(nr, nc));
        }
      }
    }
  }
  return openCells.size;
}

export function weighted_liberty(game, player) {
  // Maps each open cell to its strongest liberty contribution.
  // Immediate orthogonal: 1.0
  // Diagonal:             0.5
  // Extended orthogonal:  0.5
  const openCells = new Map();

  const libertyOffsets = [
    // Immediate orthogonal
    [-1,  0, 1.0],
    [ 1,  0, 1.0],
    [ 0, -1, 1.0],
    [ 0,  1, 1.0],

    // Diagonal
    [-1, -1, 0.5],
    [-1,  1, 0.5],
    [ 1, -1, 0.5],
    [ 1,  1, 0.5],

    // Extended orthogonal
    [-2,  0, 0.5],
    [ 2,  0, 0.5],
    [ 0, -2, 0.5],
    [ 0,  2, 0.5],
  ];

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const [owner] = ownerAndValue(game.board[r][c]);

      if (owner !== player) continue;

      for (const [dr, dc, weight] of libertyOffsets) {
        const nr = r + dr;
        const nc = c + dc;

        // Outside board
        if (
          nr < 0 ||
          nr >= N ||
          nc < 0 ||
          nc >= N
        ) {
          continue;
        }

        // Liberty must be an empty cell
        if (game.board[nr][nc] !== CellType.EMPTY) {
          continue;
        }

        const key = cellKey(nr, nc);
        const currentWeight = openCells.get(key) ?? 0;

        // If multiple pieces reach the same empty cell,
        // count that cell only once using its strongest weight.
        openCells.set(
          key,
          Math.max(currentWeight, weight),
        );
      }
    }
  }

  let totalLiberty = 0;

  for (const weight of openCells.values()) {
    totalLiberty += weight;
  }

  return totalLiberty;
}