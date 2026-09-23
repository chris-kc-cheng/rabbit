import { describe, expect, it } from "vitest";
import { correctAnswersNeeded, reachedAccuracyTarget, trophyForCompletedTrail } from "../frontend/src/raceRules";

describe("accuracy trophy rules", () => {
  it("uses an inclusive 70 percent target", () => {
    expect(correctAnswersNeeded(10, 70)).toBe(7);
    expect(reachedAccuracyTarget(7, 10, 70)).toBe(true);
    expect(reachedAccuracyTarget(6, 10, 70)).toBe(false);
  });

  it("treats an exact configured target as a win", () => {
    expect(reachedAccuracyTarget(8, 10, 80)).toBe(true);
    expect(reachedAccuracyTarget(7, 10, 80)).toBe(false);
  });

  it("reserves gold for a perfect score and awards silver otherwise", () => {
    expect(trophyForCompletedTrail(10, 10)).toBe("gold");
    expect(trophyForCompletedTrail(9, 10)).toBe("silver");
    expect(trophyForCompletedTrail(0, 10)).toBe("silver");
  });
});
