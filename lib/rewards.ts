export type RewardSettings = {
  enabled: boolean;
  targetPoints: number;
  present: string;
};

export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  enabled: false,
  targetPoints: 200,
  present: "A trip to the bookshop",
};

export const REWARD_STORAGE_KEY = "rabbit.parent.reward-settings.v1";

export function normalizeRewardSettings(value: unknown): RewardSettings {
  if (!value || typeof value !== "object") return DEFAULT_REWARD_SETTINGS;

  const candidate = value as Partial<RewardSettings>;
  const target = Number(candidate.targetPoints);
  const targetPoints = Number.isFinite(target)
    ? Math.min(10_000, Math.max(50, Math.round(target / 10) * 10))
    : DEFAULT_REWARD_SETTINGS.targetPoints;
  const present = typeof candidate.present === "string" && candidate.present.trim()
    ? candidate.present.trim().slice(0, 80)
    : DEFAULT_REWARD_SETTINGS.present;

  return {
    enabled: candidate.enabled === true,
    targetPoints,
    present,
  };
}

export function pointsProgress(points: number, targetPoints: number): number {
  if (targetPoints <= 0) return 100;
  return Math.min(100, Math.max(0, (points / targetPoints) * 100));
}
