// Browser/controller layer for Reverse Chess.
// Game rules live in game.js;
// graph/scoring analysis lives in analysis.js.

import {
  N,
  PIECES,
  TOTAL_MOVES,
  DEFAULT_VALUE_MODE,
  CellType,
  cellKey,
  createGame,
  cloneGame,
  ownerAndValue,
  placeMove,
} from "./game.js";

import {
  MinimaxAgent,
  heuristicForValueMode,
} from "./ai.js";

import {
  getComponents,
  computeComponentInfo,
  computeLCC,
  sameOwner,
} from "./analysis.js";


// =========================
// DOM
// =========================

const elBoard =
  document.getElementById("board");

const elNewGame =
  document.getElementById("newGameBtn");

const elReset =
  document.getElementById("resetBtn");

const elUndo =
  document.getElementById("undoBtn");

const elModeSelect =
  document.getElementById("modeSelect");

const elPlayModeSelect =
  document.getElementById("playModeSelect");

const elRoleSelect =
  document.getElementById("roleSelect");

const elRoleControl =
  document.getElementById("roleControl");

const elTurn =
  document.getElementById("turnPill");

const elPlayer =
  document.getElementById("playerPill");

const elNext =
  document.getElementById("nextPill");

const elResult =
  document.getElementById("result");

const elBlueScore =
  document.getElementById("blueScore");

const elRedScore =
  document.getElementById("redScore");

const elWinnerText =
  document.getElementById("winnerText");

const elCurrentBlueScore =
  document.getElementById("currentBlueScore");

const elCurrentRedScore =
  document.getElementById("currentRedScore");

const elCurrentBlueSize =
  document.getElementById("currentBlueSize");

const elCurrentRedSize =
  document.getElementById("currentRedSize");

const elBlueTracker =
  document.getElementById("blueTracker");

const elRedTracker =
  document.getElementById("redTracker");

const elStartHint =
  document.getElementById("startHint");


// =========================
// APP STATE
// =========================

let game = null;
let history = [];
let finalResult = null;

let computerThinking = false;

// Incremented whenever we invalidate
// a scheduled AI turn.
let aiGeneration = 0;


// =========================
// PLAY MODE
// =========================

function isComputerGame() {
  return (
    elPlayModeSelect?.value === "computer"
  );
}

function humanPlayer() {
  return (
    elRoleSelect?.value === "second"
      ? "red"
      : "blue"
  );
}

function computerPlayer() {
  return (
    humanPlayer() === "blue"
      ? "red"
      : "blue"
  );
}

function playerName(player) {
  return player === "blue"
    ? "Blue"
    : "Red";
}

function updateRoleControl() {
  if (!elRoleControl) {
    return;
  }

  elRoleControl.hidden =
    !isComputerGame();
}


// =========================
// START HINT
// =========================

function updateStartHint() {
  if (!elStartHint || !game) {
    return;
  }

  // The onboarding hint is only relevant
  // before the first move.
  if (game.turn > 0) {
    elStartHint.hidden = true;
    return;
  }

  elStartHint.hidden = false;

  if (isComputerGame()) {
    if (humanPlayer() === "blue") {
      elStartHint.innerHTML = `
        <span>Tap a cell to play</span>
        <span class="start-hint-arrow">↓</span>
      `;
    } else {
      elStartHint.innerHTML = `
        <span>Computer makes the first move</span>
        <span class="start-hint-arrow">↓</span>
      `;
    }
  } else {
    elStartHint.innerHTML = `
      <span>Blue — tap a cell to start</span>
      <span class="start-hint-arrow">↓</span>
    `;
  }
}


// =========================
// COMPUTER AGENT
// =========================

function createComputerAgent() {
  return new MinimaxAgent({
    depth: 2,

    solveEndgameAt: 6,

    heuristicEval:
      heuristicForValueMode(
        game.valueMode,
      ),

    deterministic: true,
  });
}


// =========================
// HISTORY
// =========================

function snapshotGame() {
  return cloneGame(game);
}

function restoreGame(snapshot) {
  game = cloneGame(snapshot);

  elModeSelect.value =
    game.valueMode;

  finalResult = null;
}

function pushHistory() {
  history.push(snapshotGame());
}


// =========================
// FINAL RESULT
// =========================

function finalizeIfNeeded() {
  if (!game.gameOver) {
    finalResult = null;
    elResult.hidden = true;

    return;
  }

  const components =
    getComponents(game);

  const blue =
    computeLCC(
      game,
      "blue",
      components,
    );

  const red =
    computeLCC(
      game,
      "red",
      components,
    );

  finalResult = {
    blue,
    red,
  };

  elBlueScore.textContent =
    String(blue.score);

  elRedScore.textContent =
    String(red.score);

  if (blue.score > red.score) {
    elWinnerText.textContent =
      "Winner: Blue";
  } else if (
    red.score > blue.score
  ) {
    elWinnerText.textContent =
      "Winner: Red";
  } else {
    elWinnerText.textContent =
      "Draw";
  }

  elResult.hidden = false;
}


// =========================
// HUMAN MOVE
// =========================

function handleCellClick(r, c) {
  if (
    computerThinking ||
    game.gameOver
  ) {
    return;
  }

  // In computer mode, only allow
  // clicks during the human player's turn.
  if (
    isComputerGame() &&
    game.current !== humanPlayer()
  ) {
    return;
  }

  if (!placeMove(game, r, c)) {
    return;
  }

  pushHistory();

  finalizeIfNeeded();
  updateStatus();
  render();

  if (
    isComputerGame() &&
    !game.gameOver &&
    game.current === computerPlayer()
  ) {
    scheduleComputerTurn();
  }
}


// =========================
// COMPUTER MOVE
// =========================

function scheduleComputerTurn() {
  const generation =
    aiGeneration;

  computerThinking = true;

  updateStatus();
  render();

  // Give the browser time to paint
  // the previous move before minimax runs.
  setTimeout(() => {
    // The game may have been reset,
    // undone, or switched while this
    // AI turn was waiting.
    if (
      generation !== aiGeneration ||
      !isComputerGame() ||
      game.gameOver ||
      game.current !== computerPlayer()
    ) {
      computerThinking = false;

      updateStatus();
      render();

      return;
    }

    const agent =
      createComputerAgent();

    const aiPlayer =
      computerPlayer();

    const action =
      agent.selectAction(
        game,
        aiPlayer,
      );

    if (action) {
      placeMove(
        game,
        action.r,
        action.c,
      );

      pushHistory();
    }

    computerThinking = false;

    finalizeIfNeeded();
    updateStatus();
    render();
  }, 120);
}


// =========================
// STATUS
// =========================

function updateStatus() {
  const t = Math.min(
    game.turn + 1,
    TOTAL_MOVES,
  );

  elTurn.textContent =
    `Turn: ${t} / ${TOTAL_MOVES}`;

  if (computerThinking) {
    elPlayer.textContent =
      `Computer is thinking… (${playerName(computerPlayer())})`;
  } else if (isComputerGame()) {
    if (game.current === humanPlayer()) {
      elPlayer.textContent =
        `Your turn (${playerName(humanPlayer())})`;
    } else {
      elPlayer.textContent =
        `Computer (${playerName(computerPlayer())})`;
    }
  } else {
    elPlayer.textContent =
      `Current: ${
        game.current === "blue"
          ? "Blue"
          : "Red"
      }`;
  }

  const nb =
    game.nextVal.blue <= PIECES
      ? game.values[
          game.nextVal.blue - 1
        ]
      : "—";

  const nr =
    game.nextVal.red <= PIECES
      ? game.values[
          game.nextVal.red - 1
        ]
      : "—";

  elNext.textContent =
    `Next piece — Blue: ${nb} · Red: ${nr}`;

  elUndo.disabled =
    history.length <= 1;
}


// =========================
// PIECE TRACKER
// =========================

function renderTracker() {
  elBlueTracker.innerHTML = "";
  elRedTracker.innerHTML = "";

  for (
    let i = 0;
    i < PIECES;
    i++
  ) {
    const value =
      game.values[i];

    for (
      const player of [
        "blue",
        "red",
      ]
    ) {
      const box =
        document.createElement(
          "div",
        );

      box.className =
        "piece-box";

      box.textContent =
        value;

      if (
        i <
        game.nextVal[player] - 1
      ) {
        box.classList.add(
          "used",
        );
      } else if (
        i ===
          game.nextVal[player] -
            1 &&
        game.current === player &&
        !game.gameOver
      ) {
        box.classList.add(
          "current",
        );
      }

      (
        player === "blue"
          ? elBlueTracker
          : elRedTracker
      ).appendChild(box);
    }
  }
}


// =========================
// BOARD
// =========================

function renderBoard(
  components,
) {
  elBoard.innerHTML = "";

  const componentInfo =
    computeComponentInfo(
      game,
      components,
    );

  const blueLcc =
    computeLCC(
      game,
      "blue",
      components,
    );

  const redLcc =
    computeLCC(
      game,
      "red",
      components,
    );

  const blueHighlight =
    game.gameOver
      ? blueLcc.highlight
      : new Set();

  const redHighlight =
    game.gameOver
      ? redLcc.highlight
      : new Set();

  for (
    let r = 0;
    r < N;
    r++
  ) {
    for (
      let c = 0;
      c < N;
      c++
    ) {
      const cell =
        document.createElement(
          "div",
        );

      cell.classList.add(
        "cell",
      );

      const value =
        game.board[r][c];

      const key =
        cellKey(r, c);

      if (
        blueHighlight.has(key) ||
        redHighlight.has(key)
      ) {
        cell.classList.add(
          "lcc",
        );
      }

      // -------------------------
      // EMPTY CELL
      // -------------------------

      if (
        value ===
        CellType.EMPTY
      ) {
        cell.classList.add(
          "empty",
        );

        const humanCanPlay =
          !game.gameOver &&
          !computerThinking &&
          (
            !isComputerGame() ||
            game.current ===
              humanPlayer()
          );

        if (humanCanPlay) {
          cell.addEventListener(
            "click",
            () =>
              handleCellClick(
                r,
                c,
              ),
          );
        } else {
          cell.style.cursor =
            "default";
        }

      // -------------------------
      // BLOCKED CELL
      // -------------------------

      } else if (
        value ===
        CellType.BLOCKED
      ) {
        cell.classList.add(
          "blocked",
        );

      // -------------------------
      // OCCUPIED CELL
      // -------------------------

      } else {
        const [
          owner,
          pieceValue,
        ] =
          ownerAndValue(
            value,
          );

        cell.classList.add(
          owner,
        );

        // Connection to right.
        if (
          sameOwner(
            game,
            r,
            c,
            r,
            c + 1,
          )
        ) {
          cell.classList.add(
            "connect-right",
          );
        }

        // Connection downward.
        if (
          sameOwner(
            game,
            r,
            c,
            r + 1,
            c,
          )
        ) {
          cell.classList.add(
            "connect-down",
          );
        }

        // Original piece value.
        const pieceValueEl =
          document.createElement(
            "span",
          );

        pieceValueEl.className =
          "piece-value";

        pieceValueEl.textContent =
          String(pieceValue);

        pieceValueEl.title =
          `Original piece value: ${pieceValue}`;

        cell.appendChild(
          pieceValueEl,
        );

        // Component score.
        if (
          componentInfo.labels.has(
            key,
          )
        ) {
          const componentValue =
            document.createElement(
              "span",
            );

          const score =
            componentInfo.scores.get(
              key,
            );

          componentValue.className =
            "component-score";

          componentValue.textContent =
            String(score);

          componentValue.title =
            `Connected component total: ${score}`;

          cell.appendChild(
            componentValue,
          );
        }

        cell.style.cursor =
          "default";
      }

      elBoard.appendChild(
        cell,
      );
    }
  }
}


// =========================
// CURRENT SCORES
// =========================

function updateCurrentScores(
  components,
) {
  const blue =
    computeLCC(
      game,
      "blue",
      components,
    );

  const red =
    computeLCC(
      game,
      "red",
      components,
    );

  elCurrentBlueScore.textContent =
    String(blue.score);

  elCurrentRedScore.textContent =
    String(red.score);

  elCurrentBlueSize.textContent =
    `${blue.size} ${
      blue.size === 1
        ? "piece"
        : "pieces"
    }`;

  elCurrentRedSize.textContent =
    `${red.size} ${
      red.size === 1
        ? "piece"
        : "pieces"
    }`;
}


// =========================
// RENDER
// =========================

function render() {
  const components =
    getComponents(game);

  // StartHint is derived entirely
  // from current game state.
  updateStartHint();

  renderBoard(components);
  renderTracker();
  updateCurrentScores(
    components,
  );
}


// =========================
// NEW / RESET GAME
// =========================

function startGame({
  sameBlock = false,
} = {}) {
  // Invalidate any pending AI turn.
  aiGeneration += 1;

  computerThinking = false;

  const valueMode =
    elModeSelect?.value ??
    DEFAULT_VALUE_MODE;

  const blockedIndex =
    sameBlock
      ? game?.blockedIndex ??
        null
      : null;

  game = createGame({
    valueMode,
    blockedIndex,
  });

  history = [
    snapshotGame(),
  ];

  finalResult = null;

  elResult.hidden = true;

  updateRoleControl();
  updateStatus();
  render();

  // If the human chose Second,
  // Blue belongs to the computer,
  // so the computer opens the game.
  if (
    isComputerGame() &&
    game.current === computerPlayer()
  ) {
    scheduleComputerTurn();
  }
}


// =========================
// UNDO
// =========================

function undoOneStep() {
  if (
    history.length <= 1
  ) {
    return;
  }

  // Cancel any scheduled AI turn.
  aiGeneration += 1;

  computerThinking = false;

  if (isComputerGame()) {
    // Remove the current state.
    history.pop();

    // Keep stepping backward until we
    // reach a human decision point.
    while (
      history.length > 1 &&
      history[
        history.length - 1
      ].current !== humanPlayer()
    ) {
      history.pop();
    }
  } else {
    history.pop();
  }

  restoreGame(
    history[
      history.length - 1
    ],
  );

  finalizeIfNeeded();
  updateStatus();
  render();

  // Normally undo lands on a human
  // decision point.
  //
  // This fallback also handles the
  // special opening state when the
  // human is playing Second.
  if (
    isComputerGame() &&
    !game.gameOver &&
    game.current === computerPlayer()
  ) {
    scheduleComputerTurn();
  }
}


// =========================
// CONTROLS
// =========================

elNewGame.addEventListener(
  "click",
  () =>
    startGame({
      sameBlock: false,
    }),
);

elReset.addEventListener(
  "click",
  () =>
    startGame({
      sameBlock: true,
    }),
);

elUndo.addEventListener(
  "click",
  undoOneStep,
);

elModeSelect.value =
  DEFAULT_VALUE_MODE;

elModeSelect.addEventListener(
  "change",
  () =>
    startGame({
      sameBlock: false,
    }),
);

if (elPlayModeSelect) {
  elPlayModeSelect.addEventListener(
    "change",
    () =>
      startGame({
        sameBlock: false,
      }),
  );
}

if (elRoleSelect) {
  elRoleSelect.addEventListener(
    "change",
    () =>
      startGame({
        sameBlock: false,
      }),
  );
}


// =========================
// START
// =========================

startGame();