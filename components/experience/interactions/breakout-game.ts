export const breakoutBoard = {
  width: 501,
  height: 720,
  left: 28,
  right: 473,
  top: 138,
  bottom: 604,
  paddleY: 578,
  paddleWidth: 108,
  paddleHeight: 12,
  ballRadius: 7,
  lives: 3,
  duration: 25,
  pointsPerBlock: 100,
} as const;

export type BreakoutStatus = "ready" | "running" | "paused" | "complete";
export type BreakoutOutcome = "won" | "lost" | "timeout" | "finished" | null;
export type BreakoutBlock = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  alive: boolean;
};
export type BreakoutGame = {
  status: BreakoutStatus;
  outcome: BreakoutOutcome;
  score: number;
  lives: number;
  elapsed: number;
  serves: number;
  paddleX: number;
  ball: { x: number; y: number; vx: number; vy: number };
  blocks: BreakoutBlock[];
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function createBreakoutGame(): BreakoutGame {
  const blockWidth = (breakoutBoard.right - breakoutBoard.left - 30) / 4;
  const paddleX = breakoutBoard.width / 2;
  return {
    status: "ready",
    outcome: null,
    score: 0,
    lives: breakoutBoard.lives,
    elapsed: 0,
    serves: 0,
    paddleX,
    ball: { x: paddleX, y: breakoutBoard.paddleY - breakoutBoard.ballRadius - 3, vx: 0, vy: 0 },
    blocks: Array.from({ length: 8 }, (_, id) => ({
      id,
      x: breakoutBoard.left + (id % 4) * (blockWidth + 10),
      y: 169 + Math.floor(id / 4) * 39,
      width: blockWidth,
      height: 26,
      alive: true,
    })),
  };
}

export function moveBreakoutPaddle(game: BreakoutGame, x: number): BreakoutGame {
  if (game.status === "complete" || !Number.isFinite(x)) return game;
  const paddleX = clamp(x, breakoutBoard.left + breakoutBoard.paddleWidth / 2, breakoutBoard.right - breakoutBoard.paddleWidth / 2);
  return {
    ...game,
    paddleX,
    ball: game.status === "ready" ? { ...game.ball, x: paddleX } : game.ball,
  };
}

export function serveBreakoutBall(game: BreakoutGame): BreakoutGame {
  if (game.status !== "ready") return game;
  const vx = game.serves % 2 === 0 ? 108 : -108;
  return {
    ...game,
    status: "running",
    serves: game.serves + 1,
    ball: { ...game.ball, vx, vy: -Math.sqrt(340 ** 2 - vx ** 2) },
  };
}

export function setBreakoutPaused(game: BreakoutGame, paused: boolean): BreakoutGame {
  if (paused && game.status === "running") return { ...game, status: "paused" };
  if (!paused && game.status === "paused") return { ...game, status: "running" };
  return game;
}

export function finishBreakoutGame(game: BreakoutGame): BreakoutGame {
  return game.status === "complete" ? game : { ...game, status: "complete", outcome: "finished" };
}

export function stepBreakoutGame(game: BreakoutGame, deltaSeconds: number): BreakoutGame {
  if (game.status !== "running" || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return game;
  const simulatedSeconds = Math.min(deltaSeconds, breakoutBoard.duration - game.elapsed);
  const steps = Math.max(1, Math.ceil(simulatedSeconds * 180));
  const step = simulatedSeconds / steps;
  const next: BreakoutGame = { ...game, ball: { ...game.ball } };
  const radius = breakoutBoard.ballRadius;

  for (let index = 0; index < steps; index += 1) {
    next.elapsed = Math.min(breakoutBoard.duration, game.elapsed + (index + 1) * step);
    const previousX = next.ball.x;
    const previousY = next.ball.y;
    next.ball.x += next.ball.vx * step;
    next.ball.y += next.ball.vy * step;

    if (next.ball.x - radius < breakoutBoard.left) {
      next.ball.x = breakoutBoard.left + radius;
      next.ball.vx = Math.abs(next.ball.vx);
    } else if (next.ball.x + radius > breakoutBoard.right) {
      next.ball.x = breakoutBoard.right - radius;
      next.ball.vx = -Math.abs(next.ball.vx);
    }
    if (next.ball.y - radius < breakoutBoard.top) {
      next.ball.y = breakoutBoard.top + radius;
      next.ball.vy = Math.abs(next.ball.vy);
    }

    const block = next.blocks.find((candidate) => candidate.alive
      && next.ball.x + radius > candidate.x && next.ball.x - radius < candidate.x + candidate.width
      && next.ball.y + radius > candidate.y && next.ball.y - radius < candidate.y + candidate.height);
    if (block) {
      next.blocks = next.blocks.map((candidate) => candidate.id === block.id ? { ...candidate, alive: false } : candidate);
      next.score += breakoutBoard.pointsPerBlock;
      const crossedTop = previousY + radius <= block.y;
      const crossedBottom = previousY - radius >= block.y + block.height;
      if (crossedTop || crossedBottom) {
        next.ball.y = crossedTop ? block.y - radius : block.y + block.height + radius;
        next.ball.vy *= -1;
      } else {
        const crossedLeft = previousX + radius <= block.x;
        next.ball.x = crossedLeft ? block.x - radius : block.x + block.width + radius;
        next.ball.vx *= -1;
      }
      if (next.blocks.every((candidate) => !candidate.alive)) {
        next.status = "complete";
        next.outcome = "won";
        return next;
      }
    }

    if (next.ball.vy > 0
      && previousY + radius <= breakoutBoard.paddleY
      && next.ball.y + radius >= breakoutBoard.paddleY
      && Math.abs(next.ball.x - next.paddleX) <= breakoutBoard.paddleWidth / 2 + radius) {
      const impact = clamp((next.ball.x - next.paddleX) / (breakoutBoard.paddleWidth / 2), -0.92, 0.92);
      const speed = Math.min(420, Math.hypot(next.ball.vx, next.ball.vy) * 1.025);
      const angle = impact * Math.PI * 0.34;
      const horizontal = Math.sin(angle) * speed;
      next.ball.x = clamp(next.ball.x, breakoutBoard.left + radius, breakoutBoard.right - radius);
      next.ball.y = breakoutBoard.paddleY - radius;
      next.ball.vx = Math.abs(horizontal) < 45 ? (next.ball.vx < 0 ? -45 : 45) : horizontal;
      next.ball.vy = -Math.sqrt(speed ** 2 - next.ball.vx ** 2);
    }

    if (next.ball.y - radius > breakoutBoard.bottom) {
      next.lives -= 1;
      next.status = next.lives > 0 ? "ready" : "complete";
      next.outcome = next.lives > 0 ? null : "lost";
      next.ball = { x: next.paddleX, y: breakoutBoard.paddleY - radius - 3, vx: 0, vy: 0 };
      return next;
    }
  }

  if (next.elapsed >= breakoutBoard.duration) {
    next.status = "complete";
    next.outcome = "timeout";
  }
  return next;
}
