export function correctAnswersNeeded(totalQuestions: number, targetAccuracy: number) {
  return Math.ceil((targetAccuracy / 100) * totalQuestions);
}

export function reachedAccuracyTarget(correctAnswers: number, totalQuestions: number, targetAccuracy: number) {
  return totalQuestions > 0 && correctAnswers >= correctAnswersNeeded(totalQuestions, targetAccuracy);
}

export type TrophyLevel = "gold" | "silver";

/** Every completed trail is an achievement; only a perfect trail earns gold. */
export function trophyForCompletedTrail(correctAnswers: number, totalQuestions: number): TrophyLevel {
  return totalQuestions > 0 && correctAnswers === totalQuestions ? "gold" : "silver";
}
