export function correctAnswersNeeded(totalQuestions: number, targetAccuracy: number) {
  return Math.ceil((targetAccuracy / 100) * totalQuestions);
}

export function reachedAccuracyTarget(correctAnswers: number, totalQuestions: number, targetAccuracy: number) {
  return totalQuestions > 0 && correctAnswers >= correctAnswersNeeded(totalQuestions, targetAccuracy);
}
