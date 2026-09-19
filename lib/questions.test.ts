import { describe, expect, it } from "vitest";
import { generateQuestions, QUESTION_TEMPLATE_COUNT } from "./questions";

describe("question generator", () => {
  it("provides ten distinct elementary math templates", () => {
    const questions = generateQuestions(42);
    expect(QUESTION_TEMPLATE_COUNT).toBe(10);
    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((question) => question.skill)).size).toBe(10);
  });

  it("is deterministic for the same seed", () => {
    expect(generateQuestions(1234)).toEqual(generateQuestions(1234));
    expect(generateQuestions(1234)).not.toEqual(generateQuestions(1235));
  });

  it("creates four unique choices with one valid correct answer", () => {
    generateQuestions(99).forEach((question) => {
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices.map((choice) => choice.value)).size).toBe(4);
      expect(question.choices.filter((choice) => choice.id === question.correctChoiceId)).toHaveLength(1);
    });
  });

  it("attaches a rationale to every wrong answer", () => {
    generateQuestions(7).forEach((question) => {
      question.choices
        .filter((choice) => choice.id !== question.correctChoiceId)
        .forEach((choice) => {
          expect(choice.misconception?.id).toBeTruthy();
          expect(choice.misconception?.feedback).toBeTruthy();
        });
    });
  });
});
