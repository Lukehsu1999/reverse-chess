// Minimax computer player for Reverse Chess.
// Ported from the Python MinimaxAgent. This module knows nothing about the DOM.

import { cloneGame, getLegalMoves, opponent, placeMove } from "./game.js";
import { computeLCC, liberty } from "./analysis.js";

export class MinimaxAgent {
  static VALID_HEURISTICS = new Set([
    "random",
    "current_lcc_diff",
    "current_lcc_diff_plus_liberty",
    "liberty",
  ]);

  constructor({
    depth = 3,
    solveEndgameAt = 10,
    heuristicEval = "current_lcc_diff_plus_liberty",
    deterministic = true,
    lccWeight = 5.0,
    libertyWeight = 7.0,
  } = {}) {
    if (!MinimaxAgent.VALID_HEURISTICS.has(heuristicEval)) {
      throw new Error(`Unknown heuristicEval: ${heuristicEval}`);
    }

    this.depth = depth;
    this.solveEndgameAt = solveEndgameAt;
    this.heuristicEval = heuristicEval;
    this.deterministic = deterministic;
    this.lccWeight = lccWeight;
    this.libertyWeight = libertyWeight;
  }

  selectAction(game, player) {
    const legalActions = getLegalMoves(game);
    if (!legalActions.length) return null;

    const remainingMoves = legalActions.length;
    const depth = remainingMoves <= this.solveEndgameAt
      ? remainingMoves
      : this.depth;

    let bestScore = -Infinity;
    let bestActions = [];
    const opponentPlayer = opponent(player);

    for (const action of this._orderedActions(game, legalActions, player)) {
      const nextGame = cloneGame(game);
      placeMove(nextGame, action.r, action.c);

      const score = this._minimax(
        nextGame,
        opponentPlayer,
        player,
        depth - 1,
        -Infinity,
        Infinity,
      );

      if (score > bestScore) {
        bestScore = score;
        bestActions = [action];
      } else if (score === bestScore) {
        bestActions.push(action);
      }
    }

    if (this.deterministic) return bestActions[0];
    return bestActions[Math.floor(Math.random() * bestActions.length)];
  }

  _minimax(game, currentPlayer, maximizingPlayer, depth, alpha, beta) {
    if (game.gameOver) return this._terminalEval(game, maximizingPlayer);
    if (depth === 0) return this._heuristic(game, maximizingPlayer);

    const legalActions = getLegalMoves(game);
    if (!legalActions.length) return this._terminalEval(game, maximizingPlayer);

    const nextPlayer = opponent(currentPlayer);

    if (currentPlayer === maximizingPlayer) {
      let value = -Infinity;
      for (const action of this._orderedActions(game, legalActions, currentPlayer)) {
        const nextGame = cloneGame(game);
        placeMove(nextGame, action.r, action.c);
        value = Math.max(
          value,
          this._minimax(nextGame, nextPlayer, maximizingPlayer, depth - 1, alpha, beta),
        );
        alpha = Math.max(alpha, value);
        if (beta <= alpha) break;
      }
      return value;
    }

    let value = Infinity;
    for (const action of this._orderedActions(game, legalActions, currentPlayer)) {
      const nextGame = cloneGame(game);
      placeMove(nextGame, action.r, action.c);
      value = Math.min(
        value,
        this._minimax(nextGame, nextPlayer, maximizingPlayer, depth - 1, alpha, beta),
      );
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return value;
  }

  _terminalEval(game, player) {
    const myScore = computeLCC(game, player).score;
    const opponentScore = computeLCC(game, opponent(player)).score;
    const scoreDiff = myScore - opponentScore;

    if (scoreDiff > 0) return 1_000_000 + scoreDiff;
    if (scoreDiff < 0) return -1_000_000 + scoreDiff;
    return 0;
  }

  _heuristic(game, player) {
    switch (this.heuristicEval) {
      case "random":
        return Math.random();
      case "current_lcc_diff":
        return this._currentLccDiff(game, player);
      case "current_lcc_diff_plus_liberty":
        return (
          this.lccWeight * this._currentLccDiff(game, player) +
          this.libertyWeight * this._libertyDiff(game, player)
        );
      case "liberty":
        return this._libertyDiff(game, player);
      default:
        throw new Error(`Unknown heuristicEval: ${this.heuristicEval}`);
    }
  }

  _currentLccDiff(game, player) {
    return computeLCC(game, player).score - computeLCC(game, opponent(player)).score;
  }

  _libertyDiff(game, player) {
    return liberty(game, player) - liberty(game, opponent(player));
  }

  _orderedActions(game, legalActions, player) {
    return legalActions
      .map((action) => {
        const nextGame = cloneGame(game);
        placeMove(nextGame, action.r, action.c);
        return { action, score: this._heuristic(nextGame, player) };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ action }) => action);
  }
}

export function heuristicForValueMode(valueMode) {
  return valueMode === "fibonacci"
    ? "liberty"
    : "current_lcc_diff_plus_liberty";
}
