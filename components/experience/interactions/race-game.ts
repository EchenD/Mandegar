export const raceBoard = { width: 501, height: 720, left: 66, right: 435, top: 0, bottom: 720, playerY: 552, carWidth: 34, carHeight: 64 } as const;
const racePace = { opening: 205, maximum: 820, rampSeconds: 60, steering: 235 } as const;
export type RaceCar = { id: number; x: number; y: number; color: string };
export type RaceGame = {
  status: "ready" | "running" | "paused" | "complete";
  outcome: "crashed" | "finished" | null;
  x: number;
  elapsed: number;
  distance: number;
  score: number;
  speed: number;
  roadOffset: number;
  spawnIn: number;
  seed: number;
  nextId: number;
  traffic: RaceCar[];
};

let savedRace: RaceGame | null = null;
export function createRaceGame(seed = 73): RaceGame {
  return { status: "ready", outcome: null, x: 250.5, elapsed: 0, distance: 0, score: 0, speed: racePace.opening, roadOffset: 0, spawnIn: 1.4, seed, nextId: 0, traffic: [] };
}
export function getSavedRace() { return savedRace ?? createRaceGame(); }
export function saveRace(game: RaceGame) { savedRace = { ...game, status: game.status === "complete" ? "complete" : "paused", traffic: game.traffic.map((car) => ({ ...car })) }; }
export function resetRace() { savedRace = null; }
export function steerRace(game: RaceGame, x: number): RaceGame {
  if (game.status === "complete") return game;
  return { ...game, x: Math.max(raceBoard.left + 25, Math.min(raceBoard.right - 25, x)) };
}
export function finishRace(game: RaceGame): RaceGame { return { ...game, status: "complete", outcome: game.outcome ?? "finished" }; }
export function toggleRace(game: RaceGame): RaceGame {
  if (game.status === "complete") return game;
  return { ...game, status: game.status === "running" ? "paused" : "running" };
}

export function getRaceSpeedMultiplier(game: Pick<RaceGame, "speed">) {
  return game.speed / racePace.opening;
}

function getSteeringSpeed(game: RaceGame) {
  // Double steering authority at four times the road speed, keeping late
  // traffic avoidable without making the opening controls overly sensitive.
  return racePace.steering * Math.sqrt(getRaceSpeedMultiplier(game));
}

/** Small simulation steps prevent cars tunnelling through each other on slow frames. */
export function stepRace(game: RaceGame, delta: number, direction = 0, targetX?: number): RaceGame {
  if (game.status !== "running" || !Number.isFinite(delta) || delta <= 0) return game;
  let next = { ...game, traffic: game.traffic.map((car) => ({ ...car })) };
  let remaining = Math.min(delta, 0.25);
  while (remaining > 0.00001 && next.status === "running") {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    const previousSpeed = next.speed;
    next.elapsed += dt;
    // Active time gives a gentle opening and a smooth arrival at full pace.
    const progress = Math.min(1, next.elapsed / racePace.rampSeconds);
    next.speed = racePace.opening + (racePace.maximum - racePace.opening) * progress * progress * (3 - 2 * progress);
    const steering = getSteeringSpeed(next);
    next = steerRace(next, targetX === undefined ? next.x + direction * steering * dt
      : next.x + Math.max(-steering * dt, Math.min(steering * dt, targetX - next.x)));
    const travel = (previousSpeed + next.speed) * 0.5 * dt;
    next.distance += travel * 0.17;
    next.score = Math.floor(next.distance);
    next.roadOffset = (next.roadOffset + travel) % 72;
    next.spawnIn -= dt;
    if (next.spawnIn <= 0) {
      next.seed = (Math.imul(next.seed, 1664525) + 1013904223) >>> 0;
      const lane = next.seed % 3;
      next.traffic.push({ id: next.nextId++, x: 127.5 + lane * 123, y: raceBoard.top - 74, color: ["#bc9a69", "#c5cbc5", "#c15d51"][lane] });
      next.spawnIn += Math.max(0.95, 1.65 - next.elapsed * 0.003);
    }
    for (const car of next.traffic) {
      car.y += travel * 0.78;
      if (Math.abs(car.x - next.x) < raceBoard.carWidth - 5
        && Math.abs(car.y - raceBoard.playerY) < raceBoard.carHeight - 9) {
        next.status = "complete";
        next.outcome = "crashed";
        break;
      }
    }
    next.traffic = next.traffic.filter((car) => car.y < raceBoard.bottom + 80);
  }
  return next;
}

export function getAutonomousTarget(game: RaceGame) {
  const lanes = [127.5, 250.5, 373.5];
  const costs = lanes.map((x) => game.traffic.reduce((cost, car) => {
    const arrivalY = car.y + game.speed * 0.78 * Math.abs(game.x - car.x) / getSteeringSpeed(game);
    const crossesLane = car.x >= Math.min(game.x, x) - 28 && car.x <= Math.max(game.x, x) + 28
      && Math.abs(car.x - game.x) > 35 && Math.abs(arrivalY - raceBoard.playerY) < 120;
    return cost + (crossesLane ? 200 : 0)
      + (Math.abs(car.x - x) < 50 && car.y > 210 && car.y < raceBoard.playerY + 68 ? 1000 / Math.max(30, Math.abs(raceBoard.playerY - car.y)) : 0);
  }, Math.abs(game.x - x) * 0.0005));
  return lanes[costs.indexOf(Math.min(...costs))];
}
