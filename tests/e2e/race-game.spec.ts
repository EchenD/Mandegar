import { expect, test } from "@playwright/test";
import {
  createRaceGame,
  getAutonomousTarget,
  getSavedRace,
  raceBoard,
  resetRace,
  saveRace,
  steerRace,
  stepRace,
  toggleRace,
  type RaceGame,
} from "../../components/experience/interactions/race-game";
import { getVisitorCreation } from "../../components/experience/interactions/visitor-creation";

function advance(game: RaceGame, seconds: number, framesPerSecond = 60, autonomous = false) {
  let current = game;
  for (let frame = 0; frame < Math.round(seconds * framesPerSecond); frame += 1) {
    current = stepRace(current, 1 / framesPerSecond, 0, autonomous ? getAutonomousTarget(current) : undefined);
  }
  return current;
}

function emptyRoad(): RaceGame {
  return { ...createRaceGame(), status: "running", spawnIn: Infinity };
}

test.afterEach(() => resetRace());

test("active driving starts gently and smoothly reaches four times its opening speed after a minute", () => {
  const opening = emptyRoad();
  const fiveSeconds = advance(opening, 5);
  const tenSeconds = advance(fiveSeconds, 5);
  const twentySeconds = advance(tenSeconds, 10);
  const thirtySeconds = advance(twentySeconds, 10);
  const fortyFiveSeconds = advance(thirtySeconds, 15);
  const maximum = advance(fortyFiveSeconds, 15);
  expect(opening.speed).toBe(205);
  expect(fiveSeconds.speed).toBeGreaterThan(205);
  expect(fiveSeconds.speed).toBeLessThan(225);
  expect(tenSeconds.speed).toBeGreaterThanOrEqual(250);
  expect(twentySeconds.speed).toBeGreaterThanOrEqual(364);
  expect(thirtySeconds.speed).toBeCloseTo(opening.speed * 2.5);
  expect(fortyFiveSeconds.speed).toBeGreaterThan(opening.speed * 3);
  expect(fortyFiveSeconds.speed).toBeLessThan(opening.speed * 4);
  expect(maximum.speed).toBeCloseTo(opening.speed * 4);
  expect(advance(maximum, 60).speed).toBe(820);
  expect(maximum.score).toBeGreaterThan(thirtySeconds.score);

  let game = opening;
  let previousIncrease = 0;
  for (let frame = 0; frame < 65 * 4; frame += 1) {
    const next = stepRace(game, 0.25);
    const increase = next.speed - game.speed;
    expect(increase).toBeGreaterThanOrEqual(0);
    expect(increase).toBeLessThanOrEqual(4);
    expect(Math.abs(increase - previousIncrease)).toBeLessThan(0.07);
    previousIncrease = increase;
    game = next;
  }
});

test("pause freezes difficulty, traffic, and distance while resume continues the same active-time ramp", () => {
  const running = advance({ ...createRaceGame(), status: "running", x: raceBoard.left + 25 }, 20);
  const paused = toggleRace(running);
  expect(paused.status).toBe("paused");
  expect(advance(paused, 120)).toBe(paused);
  expect(paused).toMatchObject({ elapsed: running.elapsed, speed: running.speed, score: running.score, traffic: running.traffic });
  const resumed = advance(toggleRace(paused), 1);
  expect(resumed.status).toBe("running");
  expect(resumed.elapsed).toBeCloseTo(running.elapsed + 1);
  expect(resumed.speed).toBeGreaterThan(running.speed);
  expect(resumed.speed).toBeLessThan(running.speed + 16);
  expect(running.elapsed).toBeCloseTo(20);
});

test("saving preserves paused progress and a fresh attempt clears speed, time, score, and traffic", () => {
  const running = advance({ ...createRaceGame(), status: "running", x: raceBoard.left + 25 }, 30);
  saveRace(running);
  const saved = getSavedRace();
  expect(saved.status).toBe("paused");
  expect(saved).toMatchObject({ elapsed: running.elapsed, speed: running.speed, score: running.score, traffic: running.traffic });
  expect(saved.traffic).not.toBe(running.traffic);
  expect(saved.traffic[0]).not.toBe(running.traffic[0]);
  resetRace();
  expect(getSavedRace()).toMatchObject({ status: "ready", elapsed: 0, speed: 205, score: 0, distance: 0, traffic: [], outcome: null });
});

test("the same active time and traffic produce the same difficulty across low and high frame rates", () => {
  const initial: RaceGame = { ...createRaceGame(), status: "running", x: raceBoard.left + 25 };
  const original = JSON.stringify(initial);
  const smooth = advance(initial, 50, 120);
  for (const framesPerSecond of [5, 30, 60, 144]) {
    const game = advance(initial, 50, framesPerSecond);
    expect(game.status).toBe("running");
    expect(game.speed).toBeCloseTo(smooth.speed, 6);
    expect(game.elapsed).toBeCloseTo(smooth.elapsed, 6);
    expect(game.distance).toBeCloseTo(smooth.distance, 1);
    expect(game.score).toBe(smooth.score);
    expect(game.nextId).toBe(smooth.nextId);
    expect(game.seed).toBe(smooth.seed);
    expect(game.traffic.map((car) => [car.id, car.x])).toEqual(smooth.traffic.map((car) => [car.id, car.x]));
    for (let index = 0; index < game.traffic.length; index += 1) {
      // Non-divisor frame rates may place a spawn within one bounded physics step.
      expect(Math.abs(game.traffic[index].y - smooth.traffic[index].y)).toBeLessThan(6);
    }
  }
  expect(JSON.stringify(initial)).toBe(original);
});

test("maximum-speed collisions are detected between slow frames and completion remains final", () => {
  const game: RaceGame = {
    ...emptyRoad(), elapsed: 60, speed: 820, x: 221.25,
    traffic: [{ id: 0, x: 250.5, y: raceBoard.playerY, color: "#c5cbc5" }],
  };
  // Both ends of an unchecked quarter-second movement clear the car; its path crosses it.
  expect(Math.abs(game.x - game.traffic[0].x)).toBeGreaterThan(raceBoard.carWidth - 5);
  expect(Math.abs(game.x + 470 * 0.25 - game.traffic[0].x)).toBeGreaterThan(raceBoard.carWidth - 5);
  const slow = stepRace(game, 0.25, 1);
  const fast = stepRace(game, 1 / 120, 1);
  expect(slow).toMatchObject({ status: "complete", outcome: "crashed" });
  expect(slow.elapsed).toBeCloseTo(fast.elapsed, 6);
  expect(slow.x).toBeCloseTo(fast.x, 6);
  expect(stepRace(slow, 1, -1)).toBe(slow);
  expect(toggleRace(slow)).toBe(slow);
  expect(steerRace(slow, 100)).toBe(slow);
  expect(game.traffic[0].y).toBe(raceBoard.playerY);
});

test("keyboard steering still clears approaching traffic at maximum speed and clamps at the shoulders", () => {
  let game: RaceGame = {
    ...emptyRoad(), elapsed: 60, speed: 820,
    traffic: [{ id: 0, x: 250.5, y: 450, color: "#c5cbc5" }],
  };
  for (let frame = 0; frame < 20; frame += 1) game = stepRace(game, 1 / 60, 1);
  expect(game.status).toBe("running");
  expect(game.x).toBeGreaterThanOrEqual(373.5);
  expect(game.traffic[0].y).toBeGreaterThan(raceBoard.playerY + raceBoard.carHeight - 9);
  expect(steerRace(game, 1000).x).toBe(raceBoard.right - 25);
  expect(steerRace(game, -1000).x).toBe(raceBoard.left + 25);
});

test("autonomous driving navigates the full ramp and the densest capped-speed traffic without changing the visitor best", () => {
  const best = getVisitorCreation().gameBest;
  for (const framesPerSecond of [5, 30]) {
    for (const seed of [1, 73, 319, 65535]) {
      const initial: RaceGame = { ...createRaceGame(seed), status: "running" };
      const ramp = advance(initial, 60, framesPerSecond, true);
      expect(ramp.status, `seed ${seed} at ${framesPerSecond} fps during ramp`).toBe("running");
      expect(ramp.speed).toBe(820);
      expect(ramp.x).toBeGreaterThanOrEqual(raceBoard.left + 25);
      expect(ramp.x).toBeLessThanOrEqual(raceBoard.right - 25);
      const dense = advance({ ...ramp, elapsed: 240 }, 60, framesPerSecond, true);
      expect(dense.status, `seed ${seed} at ${framesPerSecond} fps with minimum headway`).toBe("running");
      expect(dense.score).toBeGreaterThan(ramp.score);
      expect(dense.traffic.length).toBeLessThanOrEqual(4);
    }
  }
  expect(getVisitorCreation().gameBest).toBe(best);
});

test("invalid and stalled frames do not advance difficulty or fast-forward a resumed race", () => {
  const game = emptyRoad();
  for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(stepRace(game, delta)).toBe(game);
  const resumed = stepRace(game, 120);
  expect(resumed.elapsed).toBeCloseTo(0.25);
  expect(resumed.speed).toBeLessThan(206);
  expect(stepRace(createRaceGame(), 1).elapsed).toBe(0);
});
