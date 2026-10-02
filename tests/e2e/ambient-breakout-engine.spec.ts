import { expect, test } from "@playwright/test";
import {
  createAmbientBreakoutGame,
  stepAmbientBreakoutGame,
  type AmbientBreakoutGame,
} from "../../components/experience/interactions/ambient-breakout-game";
import {
  breakoutBoard,
  setBreakoutPaused,
} from "../../components/experience/interactions/breakout-game";

function advance(state: AmbientBreakoutGame, seconds: number, framesPerSecond = 60) {
  let current = state;
  for (let frame = 0; frame < Math.round(seconds * framesPerSecond); frame += 1) {
    current = stepAmbientBreakoutGame(current, 1 / framesPerSecond);
  }
  return current;
}

test("automatic play clears blocks and starts another round without user input", () => {
  const initial = createAmbientBreakoutGame();
  const original = JSON.stringify(initial);
  let state = initial;
  let highestScore = 0;
  let staysOnBoard = true;
  let finiteBall = true;
  for (let frame = 0; frame < 36 * 60; frame += 1) {
    state = stepAmbientBreakoutGame(state, 1 / 60);
    highestScore = Math.max(highestScore, state.game.score);
    finiteBall &&= Number.isFinite(state.game.ball.x) && Number.isFinite(state.game.ball.y);
    staysOnBoard &&= state.game.paddleX >= breakoutBoard.left + breakoutBoard.paddleWidth / 2
      && state.game.paddleX <= breakoutBoard.right - breakoutBoard.paddleWidth / 2;
  }
  expect(finiteBall).toBe(true);
  expect(staysOnBoard).toBe(true);
  expect(highestScore).toBeGreaterThanOrEqual(4 * breakoutBoard.pointsPerBlock);
  expect(state.round).toBeGreaterThanOrEqual(2);
  expect(JSON.stringify(initial)).toBe(original);
});

test("a completed round rests briefly before a fresh board is served", () => {
  let state = createAmbientBreakoutGame();
  for (let frame = 0; frame < (breakoutBoard.duration + 1) * 60 && state.game.status !== "complete"; frame += 1) {
    state = stepAmbientBreakoutGame(state, 1 / 60);
  }
  expect(state.game.status).toBe("complete");
  const finished = state.game;
  const resting = advance(state, 0.3);
  expect(resting.game).toBe(finished);
  expect(resting.round).toBe(state.round);
  expect(resting.restartDelay).toBeGreaterThan(0);
  const restarted = advance(resting, 0.5);
  expect(restarted.round).toBe(state.round + 1);
  expect(restarted.game.status).toBe("running");
  expect(restarted.game.score).toBe(0);
  expect(restarted.game.lives).toBe(breakoutBoard.lives);
  expect(restarted.game.blocks.every((block) => block.alive)).toBe(true);
});

test("missed lives are served again and a paused board resumes automatically", () => {
  const initial = createAmbientBreakoutGame();
  const missed = {
    ...initial,
    game: {
      ...initial.game,
      ball: { x: breakoutBoard.left + 10, y: breakoutBoard.bottom + 10, vx: 0, vy: 340 },
    },
  };
  const recovered = stepAmbientBreakoutGame(missed, 1 / 60);
  expect(recovered.game.lives).toBe(breakoutBoard.lives - 1);
  expect(recovered.game.serves).toBe(2);
  expect(recovered.game.status).toBe("running");
  const resumed = stepAmbientBreakoutGame({ ...recovered, game: setBreakoutPaused(recovered.game, true) }, 1 / 60);
  expect(resumed.game.status).toBe("running");
  expect(resumed.game.elapsed).toBeGreaterThan(recovered.game.elapsed);
});

test("different frame sizes preserve the same automatic collisions", () => {
  const initial = createAmbientBreakoutGame();
  const slower = advance(initial, 8, 30);
  const smoother = advance(initial, 8, 60);
  const softwareFrames = advance(initial, 8, 5);
  for (const cadence of [slower, softwareFrames]) {
    expect(cadence.round).toBe(smoother.round);
    expect(cadence.game.score).toBe(smoother.game.score);
    expect(cadence.game.lives).toBe(smoother.game.lives);
    expect(cadence.game.ball.x).toBeCloseTo(smoother.game.ball.x, 3);
    expect(cadence.game.ball.y).toBeCloseTo(smoother.game.ball.y, 3);
    expect(cadence.game.paddleX).toBeCloseTo(smoother.game.paddleX, 3);
  }
});

test("invalid or delayed frames cannot stall or fast-forward the loop", () => {
  const initial = createAmbientBreakoutGame();
  for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(stepAmbientBreakoutGame(initial, delta)).toBe(initial);
  }
  const resumed = stepAmbientBreakoutGame(initial, 120);
  expect(resumed.game.status).toBe("running");
  expect(resumed.round).toBe(1);
  expect(resumed.game.elapsed).toBeCloseTo(1);
});
