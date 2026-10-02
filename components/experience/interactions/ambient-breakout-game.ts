import {
  breakoutBoard,
  createBreakoutGame,
  moveBreakoutPaddle,
  serveBreakoutBall,
  setBreakoutPaused,
  stepBreakoutGame,
  type BreakoutGame,
} from "./breakout-game";

export type AmbientBreakoutGame = {
  game: BreakoutGame;
  round: number;
  restartDelay: number;
};

const restartPause = 0.65;
const simulationStep = 1 / 180;
const paddleSpeed = 470;

export function createAmbientBreakoutGame(): AmbientBreakoutGame {
  return {
    game: serveBreakoutBall(createBreakoutGame()),
    round: 1,
    restartDelay: 0,
  };
}

function paddleTarget(game: BreakoutGame, round: number) {
  let landing = game.ball.x;
  if (game.ball.vy > 0) {
    const travelTime = Math.max(0, (breakoutBoard.paddleY - breakoutBoard.ballRadius - game.ball.y) / game.ball.vy);
    const left = breakoutBoard.left + breakoutBoard.ballRadius;
    const width = breakoutBoard.right - breakoutBoard.ballRadius - left;
    const projected = game.ball.x + game.ball.vx * travelTime - left;
    const folded = ((projected % (width * 2)) + width * 2) % (width * 2);
    landing = left + (folded <= width ? folded : width * 2 - folded);
  }
  // A changing impact point keeps rebounds moving across the whole block row.
  return landing + Math.sin(game.elapsed * 1.8 + round * 0.8) * breakoutBoard.paddleWidth * 0.24;
}

export function stepAmbientBreakoutGame(state: AmbientBreakoutGame, deltaSeconds: number): AmbientBreakoutGame {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state;
  let game = state.game;
  let round = state.round;
  let restartDelay = state.restartDelay;
  // Preserve slow visible frames, while bounding an accidental background gap.
  let remaining = Math.min(deltaSeconds, 1);

  while (remaining > 1e-8) {
    const delta = Math.min(remaining, simulationStep);
    remaining -= delta;
    if (game.status === "complete") {
      restartDelay = Math.max(0, restartDelay - delta);
      if (restartDelay <= 1e-8) {
        game = serveBreakoutBall(createBreakoutGame());
        round += 1;
        restartDelay = 0;
      }
      continue;
    }
    if (game.status === "ready") game = serveBreakoutBall(game);
    else if (game.status === "paused") game = setBreakoutPaused(game, false);
    const distance = paddleTarget(game, round) - game.paddleX;
    const movement = Math.max(-paddleSpeed * delta, Math.min(paddleSpeed * delta, distance));
    game = moveBreakoutPaddle(game, game.paddleX + movement);
    game = stepBreakoutGame(game, delta);
    if (game.status === "complete") restartDelay = restartPause;
  }

  return { game, round, restartDelay };
}
