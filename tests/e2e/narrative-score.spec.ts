import { expect, test } from "@playwright/test";
import {
  getNarrativeBeat,
  getNarrativeFrame,
  narrativeScore,
  narrativeStageDuration,
  validateNarrativeScore,
} from "../../components/experience/narrative-score";

test.describe("narrative score", () => {
  test("covers the complete journey with contiguous authored beats", () => {
    expect(validateNarrativeScore()).toBe(true);
    expect(narrativeScore[0].start).toBe(0);
    expect(narrativeScore.at(-1)?.end).toBe(1);
  });

  test("keeps every review checkpoint inside its named beat", () => {
    for (const beat of narrativeScore) {
      expect(getNarrativeBeat(beat.preview).id).toBe(beat.id);
      expect(getNarrativeFrame(beat.preview).phase).toBe(beat.id);
    }
  });

  test("gives every stage the same duration and checkpoint spacing", () => {
    narrativeScore.forEach((beat, index) => {
      expect(beat.end - beat.start).toBeCloseTo(narrativeStageDuration, 10);
      expect(beat.preview).toBeCloseTo((index + 0.5) * narrativeStageDuration, 10);
      if (index > 0) {
        expect(beat.preview - narrativeScore[index - 1].preview).toBeCloseTo(
          narrativeStageDuration,
          10,
        );
      }
    });
  });

  test("settles into a quiet visual state at the final loop stage", () => {
    const arrival = getNarrativeFrame(0);
    const loopEnd = getNarrativeFrame(1);
    expect(arrival.living).toBe(0);
    expect(arrival.peak).toBe(0);
    expect(loopEnd.living).toBe(0);
    expect(loopEnd.peak).toBe(0);
    expect(loopEnd.reset).toBe(1);
  });
});
