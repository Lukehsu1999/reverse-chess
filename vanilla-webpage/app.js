// Reverse Chess (5x5) — Vanilla JS
// Rules:
// - 5x5 board, 1 random blocked cell (cannot place)
// - Two players alternate
// - Each player places values 1..12 in order (forced)
// - Final score = value sum of player's Largest Connected Component (4-neighbor)
// - If multiple components share max size, choose the one with max sum

const N = 5;
const PIECES = 12;
const TOTAL_MOVES = PIECES * 2;

const CellType = {
  EMPTY: 0,
  BLOCKED: "X",
};

const elBoard = document.getElementById("board");
const elNewGame = document.getElementById("newGameBtn");
const elReset = document.getElementById("resetBtn");

const elTurn = document.getElementById("turnPill");
const elPlayer = document.getElementById("playerPill");
const elNext = document.getElementById("nextPill");

const elResult = document.getElementById("result");
const elBlueScore = document.getElementById("blueScore");
const elRedScore = document.getElementById("redScore");
const elWinnerText = document.getElementById("winnerText");

let state = null;

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function idx(r, c) {
  return r * N + c;
}
function rc(i) {
  return [Math.floor(i / N), i % N];
}

function neighbors4(r, c) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < N - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < N - 1) out.push([r, c + 1]);
  return out;
}

function initState(randomBlock = true) {
  let blockedIndex = state?.blockedIndex ?? null;

  if (randomBlock || blockedIndex === null) {
    // random blocked cell
    blockedIndex = randInt(N * N);
    // If you want to exclude center, uncomment:
    // const center = idx(2,2);
    // while (blockedIndex === center) blockedIndex = randInt(N*N);
  }

  const board = Array.from({ length: N }, () => Array(N).fill(CellType.EMPTY));
  const [br, bc] = rc(blockedIndex);
  board[br][bc] = CellType.BLOCKED;

  return {
    board,
    blockedIndex,
    turn: 0,                // 0..23
    current: "blue",        // "blue" or "red"
    nextVal: { blue: 1, red: 1 },
    gameOver: false,
    lcc: { blue: new Set(), red: new Set() }, // highlight sets of "r,c"
    scores: { blue: 0, red: 0 },
  };
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function isEmptyCell(board, r, c) {
  return board[r][c] === CellType.EMPTY;
}

function place(r, c) {
  if (state.gameOver) return;

  const cell = state.board[r][c];
  if (cell !== CellType.EMPTY) return; // includes blocked

  const p = state.current;
  const v = state.nextVal[p];
  if (v > PIECES) return;

  // encode pieces as signed ints: blue positive, red negative
  state.board[r][c] = (p === "blue") ? v : -v;

  state.turn += 1;
  state.nextVal[p] += 1;
  state.current = (p === "blue") ? "red" : "blue";

  if (state.turn >= TOTAL_MOVES) {
    finalize();
  }
}

function ownerAndValue(cell) {
  if (cell === CellType.EMPTY || cell === CellType.BLOCKED) return [null, null];
  if (cell > 0) return ["blue", cell];
  return ["red", -cell];
}

function computeLCC(player) {
  const visited = Array.from({ length: N }, () => Array(N).fill(false));
  const comps = [];

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (visited[r][c]) continue;
      const [own] = ownerAndValue(state.board[r][c]);
      if (own !== player) continue;

      // BFS
      const q = [[r, c]];
      visited[r][c] = true;
      let cells = [];
      let sum = 0;

      while (q.length) {
        const [cr, cc] = q.shift();
        cells.push([cr, cc]);
        const [, val] = ownerAndValue(state.board[cr][cc]);
        sum += val;

        for (const [nr, nc] of neighbors4(cr, cc)) {
          if (visited[nr][nc]) continue;
          const [own2] = ownerAndValue(state.board[nr][nc]);
          if (own2 === player) {
            visited[nr][nc] = true;
            q.push([nr, nc]);
          }
        }
      }

      comps.push({ size: cells.length, sum, cells });
    }
  }

  if (comps.length === 0) {
    return { score: 0, highlight: new Set() };
    }

  // choose by (size desc, sum desc)
  comps.sort((a, b) => {
    if (b.size !== a.size) return b.size - a.size;
    return b.sum - a.sum;
  });

  const best = comps[0];
  const highlight = new Set(best.cells.map(([rr, cc]) => cellKey(rr, cc)));
  return { score: best.sum, highlight };
}

function finalize() {
  const blue = computeLCC("blue");
  const red = computeLCC("red");

  state.gameOver = true;
  state.scores.blue = blue.score;
  state.scores.red = red.score;
  state.lcc.blue = blue.highlight;
  state.lcc.red = red.highlight;

  // show result
  elBlueScore.textContent = String(state.scores.blue);
  elRedScore.textContent = String(state.scores.red);

  if (state.scores.blue > state.scores.red) {
    elWinnerText.textContent = "Winner: Blue";
  } else if (state.scores.red > state.scores.blue) {
    elWinnerText.textContent = "Winner: Red";
  } else {
    elWinnerText.textContent = "Draw";
  }

  elResult.hidden = false;
}

function updateStatus() {
  const t = Math.min(state.turn + 1, TOTAL_MOVES);
  elTurn.textContent = `Turn: ${t} / ${TOTAL_MOVES}`;

  const p = state.current;
  elPlayer.textContent = `Current: ${p === "blue" ? "Blue" : "Red"}`;

  const nb = state.nextVal.blue <= PIECES ? state.nextVal.blue : "—";
  const nr = state.nextVal.red <= PIECES ? state.nextVal.red : "—";
  elNext.textContent = `Next piece — Blue: ${nb} · Red: ${nr}`;
}

function render() {
  elBoard.innerHTML = "";

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");

      const v = state.board[r][c];

      // highlight if in chosen LCC after game end
      const key = cellKey(r, c);
      const inBlue = state.lcc.blue.has(key);
      const inRed = state.lcc.red.has(key);
      if (inBlue || inRed) cell.classList.add("lcc");

      if (v === CellType.EMPTY) {
        cell.classList.add("empty");
        cell.textContent = "";
        if (!state.gameOver) {
          cell.addEventListener("click", () => {
            place(r, c);
            updateStatus();
            render();
          });
        } else {
          cell.style.cursor = "default";
        }
      } else if (v === CellType.BLOCKED) {
        cell.classList.add("blocked");
        cell.textContent = "";
      } else {
        const [own, val] = ownerAndValue(v);
        cell.classList.add(own);
        cell.textContent = String(val);
        cell.style.cursor = "default";
      }

      elBoard.appendChild(cell);
    }
  }
}

function newGame() {
  state = initState(true);
  elResult.hidden = true;
  updateStatus();
  render();
}

function resetSameBlock() {
  state = initState(false);
  elResult.hidden = true;
  updateStatus();
  render();
}

// Wire up controls
elNewGame.addEventListener("click", newGame);
elReset.addEventListener("click", resetSameBlock);

// Start
newGame();