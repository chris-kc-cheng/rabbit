import { describe, expect, it } from "vitest";
import { DEFAULT_REWARD_SETTINGS, normalizeRewardSettings, pointsProgress } from "./rewards";

describe("reward settings", () => {
  it("uses safe defaults for missing or malformed settings", () => {
    expect(normalizeRewardSettings(null)).toEqual(DEFAULT_REWARD_SETTINGS);
    expect(normalizeRewardSettings("not settings")).toEqual(DEFAULT_REWARD_SETTINGS);
  });

  it("normalizes the point goal and trims the reward", () => {
    expect(normalizeRewardSettings({
      enabled: true,
      targetPoints: 127,
      present: "  Pick our family movie  ",
    })).toEqual({
      enabled: true,
      targetPoints: 130,
      present: "Pick our family movie",
    });
  });

  it("keeps point targets within supported limits", () => {
    expect(normalizeRewardSettings({ enabled: true, targetPoints: 1, present: "Small goal" }).targetPoints).toBe(50);
    expect(normalizeRewardSettings({ enabled: true, targetPoints: 50_000, present: "Big goal" }).targetPoints).toBe(10_000);
  });

  it("caps displayed progress between zero and one hundred percent", () => {
    expect(pointsProgress(-10, 200)).toBe(0);
    expect(pointsProgress(120, 200)).toBe(60);
    expect(pointsProgress(250, 200)).toBe(100);
  });
});
