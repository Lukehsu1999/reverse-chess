// Core Reverse Chess rules and state transitions.
// This module intentionally knows nothing about the DOM or rendering.

export const N = 5;
export const PIECES = 12;
export const TOTAL_MOVES = PIECES * 2;
export const DEFAULT_VALUE_MODE = "fibonacci";

export const CellType = {
  EMPTY: 0,
  BLOCKED: "X",
};

export function generateValues(mode, n = PIECES) {
  if (mode === "static") {
    return Array(n).fill(1);
  }

  if (mode === "linear") {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  if (mode === "decreaseLinear") {
    return Array.from({ length: n }, (_, i) => n - i);
  }

  if (mode === "fibonacci") {
    const fib = [1, 1];
    while (fib.length < n) {
      fib.push(
        fib[fib.length - 1] +
        fib[fib.length - 2]
      );
    }
    return fib.slice(0, n);
  }

  return Array.from(
    { length: n },
    (_, i) => i + 1
  );
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function rc(i) {
  return [Math.floor(i / N), i % N];
}

export function idx(r, c) {
  return r * N + c;
}

export function neighbors4(r, c) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < N - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < N - 1) out.push([r, c + 1]);
  return out;
}

export function cellKey(r, c) {
  return `${r},${c}`;
}

export function opponent(player) {
  return player === "blue" ? "red" : "blue";
}

export function ownerAndValue(cell) {
  if (cell === CellType.EMPTY || cell === CellType.BLOCKED) {
    return [null, null];
  }
  return cell > 0 ? ["blue", cell] : ["red", -cell];
}

export function createGame({ valueMode = DEFAULT_VALUE_MODE, blockedIndex = null } = {}) {
  const actualBlockedIndex = blockedIndex ?? Math.floor(Math.random() * N * N);
  const board = Array.from({ length: N }, () => Array(N).fill(CellType.EMPTY));
  const [br, bc] = rc(actualBlockedIndex);
  board[br][bc] = CellType.BLOCKED;

  return {
    board,
    blockedIndex: actualBlockedIndex,
    turn: 0,
    current: "blue",
    nextVal: { blue: 1, red: 1 },
    gameOver: false,
    valueMode,
    values: generateValues(valueMode, PIECES),
  };
}

export function cloneGame(game) {
  return {
    board: cloneBoard(game.board),
    blockedIndex: game.blockedIndex,
    turn: game.turn,
    current: game.current,
    nextVal: { ...game.nextVal },
    gameOver: game.gameOver,
    valueMode: game.valueMode,
    values: [...game.values],
  };
}

export function isLegalMove(game, r, c) {
  return (
    !game.gameOver &&
    r >= 0 && r < N && c >= 0 && c < N &&
    game.board[r][c] === CellType.EMPTY &&
    game.nextVal[game.current] <= PIECES
  );
}

export function getLegalMoves(game) {
  const moves = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (isLegalMove(game, r, c)) moves.push({ r, c });
    }
  }
  return moves;
}

export function getCurrentPieceValue(game, player = game.current) {
  const pieceNumber = game.nextVal[player];
  return pieceNumber <= PIECES ? game.values[pieceNumber - 1] : null;
}

export function placeMove(game, r, c) {
  if (!isLegalMove(game, r, c)) return false;

  const player = game.current;
  const value = getCurrentPieceValue(game, player);
  game.board[r][c] = player === "blue" ? value : -value;
  game.turn += 1;
  game.nextVal[player] += 1;
  game.current = opponent(player);
  game.gameOver = game.turn >= TOTAL_MOVES;
  return true;
}
