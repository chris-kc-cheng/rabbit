import { describe, expect, it } from "vitest";
import { correctAnswersNeeded, reachedAccuracyTarget } from "../frontend/src/raceRules";

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
});
