import { expect, test } from "@playwright/test";
import {
  breakoutBoard,
  createBreakoutGame,
  finishBreakoutGame,
  moveBreakoutPaddle,
  serveBreakoutBall,
  setBreakoutPaused,
  stepBreakoutGame,
} from "../../components/experience/interactions/breakout-game";

test("the paddle stays inside the board and carries the ball before serving", () => {
  const original = createBreakoutGame();
  const left = moveBreakoutPaddle(original, -100);
  const right = moveBreakoutPaddle(left, 1000);
  expect(left.paddleX).toBe(breakoutBoard.left + breakoutBoard.paddleWidth / 2);
  expect(right.paddleX).toBe(breakoutBoard.right - breakoutBoard.paddleWidth / 2);
  expect(right.ball.x).toBe(right.paddleX);
  expect(original.paddleX).toBe(breakoutBoard.width / 2);
  expect(moveBreakoutPaddle(right, Number.NaN)).toBe(right);
});

test("a broken block awards points once and reflects the ball without changing the previous frame", () => {
  const game = serveBreakoutBall(createBreakoutGame());
  const block = game.blocks[4];
  game.ball = {
    x: block.x + block.width / 2,
    y: block.y + block.height + breakoutBoard.ballRadius + 2,
    vx: 0,
    vy: -340,
  };
  const hit = stepBreakoutGame(game, 0.02);
  expect(hit.blocks[4].alive).toBe(false);
  expect(hit.score).toBe(breakoutBoard.pointsPerBlock);
  expect(hit.ball.vy).toBeGreaterThan(0);
  expect(game.blocks[4].alive).toBe(true);
  expect(game.score).toBe(0);
  expect(stepBreakoutGame(hit, 0.02).score).toBe(hit.score);
});

test("the side of the paddle controls the bounce direction", () => {
  for (const direction of [-1, 1]) {
    const game = serveBreakoutBall(createBreakoutGame());
    game.ball = {
      x: game.paddleX + direction * breakoutBoard.paddleWidth * 0.4,
      y: breakoutBoard.paddleY - breakoutBoard.ballRadius - 2,
      vx: 0,
      vy: 340,
    };
    const bounce = stepBreakoutGame(game, 0.02);
    expect(bounce.ball.vy).toBeLessThan(0);
    expect(Math.sign(bounce.ball.vx)).toBe(direction);
    expect(Math.hypot(bounce.ball.vx, bounce.ball.vy)).toBeLessThanOrEqual(420);
  }
});

test("misses use one life at a time and the third miss ends the round", () => {
  let game = createBreakoutGame();
  for (let lives = breakoutBoard.lives - 1; lives >= 0; lives -= 1) {
    game = serveBreakoutBall(game);
    game.ball = { x: breakoutBoard.left + 10, y: breakoutBoard.bottom + 10, vx: 0, vy: 340 };
    game = stepBreakoutGame(game, 1 / 60);
    expect(game.lives).toBe(lives);
    expect(game.status).toBe(lives > 0 ? "ready" : "complete");
  }
  expect(game.outcome).toBe("lost");
  expect(serveBreakoutBall(game)).toBe(game);
});

test("pausing freezes the ball and active-play timer until resuming", () => {
  const running = serveBreakoutBall(createBreakoutGame());
  const paused = setBreakoutPaused(running, true);
  expect(stepBreakoutGame(paused, 10)).toBe(paused);
  const resumed = stepBreakoutGame(setBreakoutPaused(paused, false), 0.1);
  expect(resumed.elapsed).toBeCloseTo(0.1);
  expect(resumed.ball.y).toBeLessThan(paused.ball.y);
});

test("clearing the final block wins and keeps the completed board still", () => {
  const game = serveBreakoutBall(createBreakoutGame());
  game.blocks = game.blocks.map((block, index) => ({ ...block, alive: index === 0 }));
  game.score = 7 * breakoutBoard.pointsPerBlock;
  const block = game.blocks[0];
  game.ball = {
    x: block.x + block.width / 2,
    y: block.y + block.height + breakoutBoard.ballRadius + 2,
    vx: 0,
    vy: -340,
  };
  const won = stepBreakoutGame(game, 0.02);
  expect(won).toMatchObject({ status: "complete", outcome: "won", score: 800 });
  expect(stepBreakoutGame(won, 2)).toBe(won);
  expect(moveBreakoutPaddle(won, 50)).toBe(won);
});

test("the round ends at the active-play limit and can also be finished early", () => {
  const game = serveBreakoutBall(createBreakoutGame());
  game.elapsed = breakoutBoard.duration - 0.01;
  expect(stepBreakoutGame(game, 0.1)).toMatchObject({
    elapsed: breakoutBoard.duration,
    status: "complete",
    outcome: "timeout",
  });
  const finished = finishBreakoutGame(serveBreakoutBall(createBreakoutGame()));
  expect(finished).toMatchObject({ status: "complete", outcome: "finished" });
  expect(stepBreakoutGame(finished, 1)).toBe(finished);
});

test("a slow frame preserves the same collisions as smaller frames", () => {
  const initial = serveBreakoutBall(createBreakoutGame());
  const slow = stepBreakoutGame(initial, 1.5);
  let smooth = initial;
  for (let frame = 0; frame < 180; frame += 1) smooth = stepBreakoutGame(smooth, 1 / 120);
  expect(slow.score).toBe(smooth.score);
  expect(slow.lives).toBe(smooth.lives);
  expect(slow.ball.x).toBeCloseTo(smooth.ball.x, 1);
  expect(slow.ball.y).toBeCloseTo(smooth.ball.y, 1);
});
