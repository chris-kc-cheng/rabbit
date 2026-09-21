export type ContentBlock = { type: "text" | "math"; value: string };
export type Choice = { id: string; value: string };
export type Question = {
  id: string;
  template_id: string;
  skill: string;
  difficulty: number;
  prompt: ContentBlock[];
  choices: Choice[];
  hint: string;
  visual?: { type: "fraction-bar"; numerator: number; denominator: number; alt: string } | null;
};
export type Session = { id: string; learner_id: string; questions: Question[] };
export type AttemptResult = {
  correct: boolean;
  correct_choice_id: string;
  feedback: string;
  explanation: string;
  misconception_id?: string | null;
  points_earned: number;
};
export type Reward = { enabled: boolean; target_points: number; reward: string };
export type Progress = {
  learner_id: string;
  attempts: number;
  correct: number;
  points: number;
  accuracy: number;
  misconceptions: Record<string, number>;
  recent_attempts: Array<{ question_id: string; skill: string; selected_value: string; correct: boolean; misconception_id?: string }>;
  reward: Reward;
};

export type DemoSubject = "math" | "trivia" | "english";
export type DemoQuestion = {
  id: string;
  subject: DemoSubject;
  kind: "single-select" | "multi-select" | "fill-blank" | "reorder" | "correction";
  title: string;
  instruction: string;
  visual?: "triangle" | "prism";
  latex?: string;
  image?: string;
  image_alt?: string;
  placeholder?: string;
  choices?: Array<{ id: string; label: string }>;
  tiles?: Array<{ id: string; label: string }>;
};
export type DemoSession = { id: string; questions: DemoQuestion[] };
export type DemoResult = { correct: boolean; feedback: string; points_earned: number };
