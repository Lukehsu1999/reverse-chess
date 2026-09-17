// Reverse Chess (5x5) — Vanilla JS
// Rules:
// - 5x5 board, 1 random blocked cell (cannot place)
// - Two players alternate
// - Each player places values according to selected value mode
// - Final score = value sum of player's Largest Connected Component (4-neighbor)
// - If multiple components share max size, choose the one with max sum

const N = 5;
const PIECES = 12;
const TOTAL_MOVES = PIECES * 2;


// =========================
// VALUE SYSTEM
// =========================

const DEFAULT_VALUE_MODE = "fibonacci";

function generateValues(mode, n) {
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

  return Array.from({ length: n }, (_, i) => i + 1);
}


let currentValueMode = DEFAULT_VALUE_MODE;
let VALUES = generateValues(currentValueMode, PIECES);


const CellType = {
  EMPTY: 0,
  BLOCKED: "X",
};


// =========================
// DOM
// =========================

const elBoard = document.getElementById("board");

const elNewGame = document.getElementById("newGameBtn");
const elReset = document.getElementById("resetBtn");
const elUndo = document.getElementById("undoBtn");
const elModeSelect = document.getElementById("modeSelect");

const elTurn = document.getElementById("turnPill");
const elPlayer = document.getElementById("playerPill");
const elNext = document.getElementById("nextPill");

const elResult = document.getElementById("result");
const elBlueScore = document.getElementById("blueScore");
const elRedScore = document.getElementById("redScore");
const elWinnerText = document.getElementById("winnerText");

const elBlueTracker = document.getElementById("blueTracker");
const elRedTracker = document.getElementById("redTracker");


let state = null;
let history = [];


// =========================
// STATE HELPERS
// =========================

function cloneBoard(board) {
  return board.map(row => row.slice());
}


function snapshotState(s) {
  return {
    board: cloneBoard(s.board),

    blockedIndex: s.blockedIndex,
    turn: s.turn,
    current: s.current,

    nextVal: {
      blue: s.nextVal.blue,
      red: s.nextVal.red,
    },

    gameOver: s.gameOver,

    scores: {
      blue: s.scores.blue,
      red: s.scores.red,
    },

    lcc: {
      blue: Array.from(s.lcc.blue),
      red: Array.from(s.lcc.red),
    },

    valueMode: currentValueMode,
  };
}


function restoreSnapshot(snap) {
  currentValueMode =
    snap.valueMode ?? DEFAULT_VALUE_MODE;

  VALUES =
    generateValues(
      currentValueMode,
      PIECES
    );


  if (elModeSelect) {
    elModeSelect.value =
      currentValueMode;
  }


  state = {
    board:
      cloneBoard(snap.board),

    blockedIndex:
      snap.blockedIndex,

    turn:
      snap.turn,

    current:
      snap.current,

    nextVal: {
      blue:
        snap.nextVal.blue,

      red:
        snap.nextVal.red,
    },

    gameOver:
      snap.gameOver,

    scores: {
      blue:
        snap.scores.blue,

      red:
        snap.scores.red,
    },

    lcc: {
      blue:
        new Set(snap.lcc.blue),

      red:
        new Set(snap.lcc.red),
    },
  };
}


// =========================
// BOARD HELPERS
// =========================

function randInt(max) {
  return Math.floor(
    Math.random() * max
  );
}


function idx(r, c) {
  return r * N + c;
}


function rc(i) {
  return [
    Math.floor(i / N),
    i % N,
  ];
}


function neighbors4(r, c) {
  const out = [];

  if (r > 0) {
    out.push([r - 1, c]);
  }

  if (r < N - 1) {
    out.push([r + 1, c]);
  }

  if (c > 0) {
    out.push([r, c - 1]);
  }

  if (c < N - 1) {
    out.push([r, c + 1]);
  }

  return out;
}


function cellKey(r, c) {
  return `${r},${c}`;
}


function ownerAndValue(cell) {
  if (
    cell === CellType.EMPTY ||
    cell === CellType.BLOCKED
  ) {
    return [null, null];
  }

  if (cell > 0) {
    return ["blue", cell];
  }

  return ["red", -cell];
}


// =========================
// INITIAL STATE
// =========================

function initState(randomBlock = true) {
  let blockedIndex =
    state?.blockedIndex ?? null;


  if (
    randomBlock ||
    blockedIndex === null
  ) {
    blockedIndex =
      randInt(N * N);
  }


  const board =
    Array.from(
      { length: N },
      () =>
        Array(N).fill(
          CellType.EMPTY
        )
    );


  const [br, bc] =
    rc(blockedIndex);


  board[br][bc] =
    CellType.BLOCKED;


  return {
    board,
    blockedIndex,

    turn: 0,
    current: "blue",

    nextVal: {
      blue: 1,
      red: 1,
    },

    gameOver: false,

    lcc: {
      blue: new Set(),
      red: new Set(),
    },

    scores: {
      blue: 0,
      red: 0,
    },
  };
}


// =========================
// PLACEMENT
// =========================

function place(r, c) {
  if (state.gameOver) {
    return false;
  }


  const cell =
    state.board[r][c];


  if (cell !== CellType.EMPTY) {
    return false;
  }


  const p =
    state.current;


  const index =
    state.nextVal[p] - 1;


  if (index >= PIECES) {
    return false;
  }


  const v =
    VALUES[index];


  state.board[r][c] =
    (p === "blue")
      ? v
      : -v;


  state.turn += 1;

  state.nextVal[p] += 1;


  state.current =
    (p === "blue")
      ? "red"
      : "blue";


  if (
    state.turn >= TOTAL_MOVES
  ) {
    finalize();
  }


  if (history.length) {
    history.push(
      snapshotState(state)
    );
  }


  return true;
}


// =========================
// COMPONENT INFORMATION
// =========================
//
// Each connected component gets:
//
// - total component value
// - one label cell
//
// The label cell is the occupied cell
// closest to the component centroid.
//
// Returns:
//
// {
//   scores: Map("r,c" -> total),
//   labels: Set("r,c")
// }

function computeComponentInfo() {
  const scores = new Map();
  const labels = new Set();


  const visited =
    Array.from(
      { length: N },
      () =>
        Array(N).fill(false)
    );


  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {

      if (visited[r][c]) {
        continue;
      }


      const [player] =
        ownerAndValue(
          state.board[r][c]
        );


      if (player === null) {
        continue;
      }


      const queue =
        [[r, c]];


      const cells = [];


      let sum = 0;


      visited[r][c] = true;


      // -------------------------
      // FIND COMPONENT
      // -------------------------

      while (queue.length) {
        const [cr, cc] =
          queue.shift();


        cells.push(
          [cr, cc]
        );


        const [, value] =
          ownerAndValue(
            state.board[cr][cc]
          );


        sum += value;


        for (
          const [nr, nc]
          of neighbors4(cr, cc)
        ) {

          if (
            visited[nr][nc]
          ) {
            continue;
          }


          const [neighborPlayer] =
            ownerAndValue(
              state.board[nr][nc]
            );


          if (
            neighborPlayer === player
          ) {

            visited[nr][nc] =
              true;


            queue.push(
              [nr, nc]
            );
          }
        }
      }


      // -------------------------
      // STORE COMPONENT TOTAL
      // -------------------------

      for (
        const [cr, cc]
        of cells
      ) {

        scores.set(
          cellKey(cr, cc),
          sum
        );
      }


      // -------------------------
      // COMPONENT CENTROID
      // -------------------------

      let rowSum = 0;
      let colSum = 0;


      for (
        const [cr, cc]
        of cells
      ) {

        rowSum += cr;
        colSum += cc;
      }


      const centroidRow =
        rowSum / cells.length;


      const centroidCol =
        colSum / cells.length;


      // -------------------------
      // CLOSEST OCCUPIED CELL
      // -------------------------

      let labelCell =
        cells[0];


      let bestDistance =
        Infinity;


      for (
        const [cr, cc]
        of cells
      ) {

        const dr =
          cr - centroidRow;


        const dc =
          cc - centroidCol;


        const distance =
          dr * dr +
          dc * dc;


        if (
          distance <
          bestDistance
        ) {

          bestDistance =
            distance;


          labelCell =
            [cr, cc];
        }
      }


      labels.add(
        cellKey(
          labelCell[0],
          labelCell[1]
        )
      );
    }
  }


  return {
    scores,
    labels,
  };
}


// =========================
// CONNECTION HELPERS
// =========================
//
// These functions determine whether
// two neighboring cells belong to
// the same player.
//
// We only need to check RIGHT and DOWN
// during rendering because the left/up
// connections are already drawn by the
// neighboring cells.
//
// Example:
//
//  RED CELL ---- RED CELL
//
//  connect-right draws the bridge.
//
//
//  RED CELL
//      |
//      |
//  RED CELL
//
//  connect-down draws the bridge.
//

function sameOwner(r1, c1, r2, c2) {
  if (
    r2 < 0 ||
    r2 >= N ||
    c2 < 0 ||
    c2 >= N
  ) {
    return false;
  }


  const [owner1] =
    ownerAndValue(
      state.board[r1][c1]
    );


  const [owner2] =
    ownerAndValue(
      state.board[r2][c2]
    );


  return (
    owner1 !== null &&
    owner1 === owner2
  );
}


// =========================
// FINAL LCC
// =========================

function computeLCC(player) {
  const visited =
    Array.from(
      { length: N },
      () =>
        Array(N).fill(false)
    );


  const comps = [];


  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {

      if (visited[r][c]) {
        continue;
      }


      const [own] =
        ownerAndValue(
          state.board[r][c]
        );


      if (own !== player) {
        continue;
      }


      const q =
        [[r, c]];


      visited[r][c] =
        true;


      let cells = [];
      let sum = 0;


      while (q.length) {
        const [cr, cc] =
          q.shift();


        cells.push(
          [cr, cc]
        );


        const [, val] =
          ownerAndValue(
            state.board[cr][cc]
          );


        sum += val;


        for (
          const [nr, nc]
          of neighbors4(cr, cc)
        ) {

          if (
            visited[nr][nc]
          ) {
            continue;
          }


          const [own2] =
            ownerAndValue(
              state.board[nr][nc]
            );


          if (
            own2 === player
          ) {

            visited[nr][nc] =
              true;


            q.push(
              [nr, nc]
            );
          }
        }
      }


      comps.push({
        size:
          cells.length,

        sum,
        cells,
      });
    }
  }


  if (
    comps.length === 0
  ) {

    return {
      score: 0,
      highlight:
        new Set(),
    };
  }


  comps.sort(
    (a, b) => {

      if (
        b.size !== a.size
      ) {
        return (
          b.size - a.size
        );
      }


      return (
        b.sum - a.sum
      );
    }
  );


  const best =
    comps[0];


  const highlight =
    new Set(
      best.cells.map(
        ([rr, cc]) =>
          cellKey(rr, cc)
      )
    );


  return {
    score:
      best.sum,

    highlight,
  };
}


// =========================
// FINALIZE
// =========================

function finalize() {
  const blue =
    computeLCC("blue");


  const red =
    computeLCC("red");


  state.gameOver =
    true;


  state.scores.blue =
    blue.score;


  state.scores.red =
    red.score;


  state.lcc.blue =
    blue.highlight;


  state.lcc.red =
    red.highlight;


  elBlueScore.textContent =
    String(
      state.scores.blue
    );


  elRedScore.textContent =
    String(
      state.scores.red
    );


  if (
    state.scores.blue >
    state.scores.red
  ) {

    elWinnerText.textContent =
      "Winner: Blue";

  } else if (
    state.scores.red >
    state.scores.blue
  ) {

    elWinnerText.textContent =
      "Winner: Red";

  } else {

    elWinnerText.textContent =
      "Draw";
  }


  elResult.hidden =
    false;
}


// =========================
// STATUS
// =========================

function updateStatus() {
  const t =
    Math.min(
      state.turn + 1,
      TOTAL_MOVES
    );


  elTurn.textContent =
    `Turn: ${t} / ${TOTAL_MOVES}`;


  const p =
    state.current;


  elPlayer.textContent =
    `Current: ${
      p === "blue"
        ? "Blue"
        : "Red"
    }`;


  const nb =
    state.nextVal.blue <= PIECES
      ? VALUES[
          state.nextVal.blue - 1
        ]
      : "—";


  const nr =
    state.nextVal.red <= PIECES
      ? VALUES[
          state.nextVal.red - 1
        ]
      : "—";


  elNext.textContent =
    `Next piece — Blue: ${nb} · Red: ${nr}`;


  updateUndoBtn();
}


function updateUndoBtn() {
  if (!elUndo) {
    return;
  }


  elUndo.disabled =
    history.length <= 1;
}


// =========================
// PIECE TRACKER
// =========================

function renderTracker() {
  elBlueTracker.innerHTML =
    "";


  elRedTracker.innerHTML =
    "";


  for (
    let i = 0;
    i < PIECES;
    i++
  ) {

    const val =
      VALUES[i];


    // BLUE

    const blueBox =
      document.createElement(
        "div"
      );


    blueBox.className =
      "piece-box";


    blueBox.textContent =
      val;


    if (
      i <
      state.nextVal.blue - 1
    ) {

      blueBox.classList.add(
        "used"
      );

    } else if (
      i ===
        state.nextVal.blue - 1 &&
      state.current ===
        "blue" &&
      !state.gameOver
    ) {

      blueBox.classList.add(
        "current"
      );
    }


    elBlueTracker.appendChild(
      blueBox
    );


    // RED

    const redBox =
      document.createElement(
        "div"
      );


    redBox.className =
      "piece-box";


    redBox.textContent =
      val;


    if (
      i <
      state.nextVal.red - 1
    ) {

      redBox.classList.add(
        "used"
      );

    } else if (
      i ===
        state.nextVal.red - 1 &&
      state.current ===
        "red" &&
      !state.gameOver
    ) {

      redBox.classList.add(
        "current"
      );
    }


    elRedTracker.appendChild(
      redBox
    );
  }
}


// =========================
// BOARD RENDERING
// =========================

function render() {
  elBoard.innerHTML = "";


  const componentInfo =
    computeComponentInfo();


  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {

      const cell =
        document.createElement(
          "div"
        );


      cell.classList.add(
        "cell"
      );


      const v =
        state.board[r][c];


      const key =
        cellKey(r, c);


      const inBlue =
        state.lcc.blue.has(key);


      const inRed =
        state.lcc.red.has(key);


      if (
        inBlue ||
        inRed
      ) {

        cell.classList.add(
          "lcc"
        );
      }


      // =====================
      // EMPTY
      // =====================

      if (
        v === CellType.EMPTY
      ) {

        cell.classList.add(
          "empty"
        );


        cell.textContent =
          "";


        if (
          !state.gameOver
        ) {

          cell.addEventListener(
            "click",
            () => {

              const ok =
                place(r, c);


              if (ok) {

                elResult.hidden =
                  !state.gameOver;
              }


              updateStatus();
              render();
            }
          );

        } else {

          cell.style.cursor =
            "default";
        }


      // =====================
      // BLOCKED
      // =====================

      } else if (
        v ===
        CellType.BLOCKED
      ) {

        cell.classList.add(
          "blocked"
        );


        cell.textContent =
          "";


      // =====================
      // OCCUPIED
      // =====================

      } else {

        const [own, val] =
          ownerAndValue(v);


        const componentScore =
          componentInfo.scores.get(
            key
          );


        const isLabelCell =
          componentInfo.labels.has(
            key
          );


        cell.classList.add(
          own
        );


        // ---------------------
        // CONNECTIONS
        // ---------------------
        //
        // Same-owner neighbor
        // to the RIGHT:
        //
        // [cell] === [cell]
        //

        if (
          sameOwner(
            r,
            c,
            r,
            c + 1
          )
        ) {

          cell.classList.add(
            "connect-right"
          );
        }


        // Same-owner neighbor
        // BELOW:
        //
        // [cell]
        //   ||
        // [cell]
        //

        if (
          sameOwner(
            r,
            c,
            r + 1,
            c
          )
        ) {

          cell.classList.add(
            "connect-down"
          );
        }


        // ---------------------
        // ORIGINAL PIECE VALUE
        // ---------------------

        const pieceValue =
          document.createElement(
            "span"
          );


        pieceValue.className =
          "piece-value";


        pieceValue.textContent =
          String(val);


        pieceValue.title =
          `Original piece value: ${val}`;


        cell.appendChild(
          pieceValue
        );


        // ---------------------
        // COMPONENT SCORE
        // ---------------------

        if (isLabelCell) {

          const componentValue =
            document.createElement(
              "span"
            );


          componentValue.className =
            "component-score";


          componentValue.textContent =
            String(
              componentScore
            );


          componentValue.title =
            `Connected component total: ${componentScore}`;


          cell.appendChild(
            componentValue
          );
        }


        cell.style.cursor =
          "default";
      }


      elBoard.appendChild(
        cell
      );
    }
  }


  renderTracker();
}


// =========================
// VALUE MODE
// =========================

function applyModeFromSelect() {
  if (!elModeSelect) {
    return;
  }


  currentValueMode =
    elModeSelect.value;


  VALUES =
    generateValues(
      currentValueMode,
      PIECES
    );
}


// =========================
// GAME CONTROLS
// =========================

function newGame() {
  applyModeFromSelect();


  state =
    initState(true);


  history = [
    snapshotState(state)
  ];


  elResult.hidden =
    true;


  updateStatus();
  render();


  console.log(
    "VALUE MODE:",
    currentValueMode
  );


  console.log(
    "VALUES:",
    VALUES
  );
}


function resetSameBlock() {
  applyModeFromSelect();


  state =
    initState(false);


  history = [
    snapshotState(state)
  ];


  elResult.hidden =
    true;


  updateStatus();
  render();


  console.log(
    "VALUE MODE:",
    currentValueMode
  );


  console.log(
    "VALUES:",
    VALUES
  );
}


function undoOneStep() {
  if (
    history.length <= 1
  ) {
    return;
  }


  history.pop();


  const prev =
    history[
      history.length - 1
    ];


  restoreSnapshot(prev);


  if (state.gameOver) {

    elBlueScore.textContent =
      String(
        state.scores.blue
      );


    elRedScore.textContent =
      String(
        state.scores.red
      );


    if (
      state.scores.blue >
      state.scores.red
    ) {

      elWinnerText.textContent =
        "Winner: Blue";

    } else if (
      state.scores.red >
      state.scores.blue
    ) {

      elWinnerText.textContent =
        "Winner: Red";

    } else {

      elWinnerText.textContent =
        "Draw";
    }


    elResult.hidden =
      false;

  } else {

    elResult.hidden =
      true;
  }


  updateStatus();
  render();
}


// =========================
// WIRE CONTROLS
// =========================

elNewGame.addEventListener(
  "click",
  newGame
);


elReset.addEventListener(
  "click",
  resetSameBlock
);


if (elUndo) {

  elUndo.addEventListener(
    "click",
    undoOneStep
  );
}


if (elModeSelect) {

  elModeSelect.value =
    DEFAULT_VALUE_MODE;


  elModeSelect.addEventListener(
    "change",
    () => {
      newGame();
    }
  );
}


// =========================
// START
// =========================

newGame();