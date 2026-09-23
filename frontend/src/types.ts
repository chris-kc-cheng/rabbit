export type ContentBlock = { type: "text" | "math"; value: string };
export type Choice = { id: string; value: string };
type BaseVisual = { alt: string };
export type QuestionVisual =
  | (BaseVisual & { type: "fraction-bar"; numerator: number; denominator: number })
  | (BaseVisual & { type: "data-table"; caption: string; columns: string[]; rows: string[][] })
  | (BaseVisual & { type: "rectangle-grid"; width: number; height: number; shaded?: number; unit: string })
  | (BaseVisual & { type: "angle"; degrees: number; label?: string })
  | (BaseVisual & { type: "triangle"; kind: "right" | "isosceles"; base: number; height: number; unit: string; unknown?: "base" | "height" })
  | (BaseVisual & { type: "solid"; kind: "rectangular-prism" | "cube"; length: number; width: number; height: number; unit: string })
  | (BaseVisual & { type: "scene-2d"; points: Array<{ id: string; x: number; y: number; label?: string }>; segments: Array<{ from: string; to: string; label?: string }>; polygons?: Array<{ points: string[]; shaded?: boolean }> });
export type Question = {
  id: string;
  template_id: string;
  skill: string;
  difficulty: number;
  prompt: ContentBlock[];
  choices: Choice[];
  hint: string;
  visual?: QuestionVisual | null;
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
export type Reward = { enabled: boolean; target_accuracy: number; reward: string };
export type Progress = {
  learner_id: string;
  attempts: number;
  correct: number;
  points: number;
  accuracy: number;
  hints_used: number;
  misconceptions: Record<string, number>;
  recent_attempts: AttemptHistoryItem[];
  attempt_history: AttemptHistoryItem[];
  reward: Reward;
};
export type AttemptHistoryItem = {
  question_id: string;
  skill: string;
  selected_value: string;
  correct_value: string;
  correct: boolean;
  hint_used: boolean;
  misconception_id?: string;
  answered_at: string;
  time_spent_ms: number;
  question: Question;
};
export type User = { id: string; role: "admin" | "parent" | "learner"; username: string; display_name: string; parent_id?: string | null; disabled: boolean; default_subject?: string; default_topics?: string[] };
export type AuthSession = { access_token: string; expires_at: number; user: User };
export type FamilyLearner = User & { progress: Progress; is_self: boolean };
export type ImportError = { path: string; message: string; suggestion: string };
export type FamilyProgress = { family_id: string; learners: Array<{ id: string; name: string; progress: Progress }> };
export type Subject = { id: string; title: string; template_count: number; publication_status: "draft" | "published"; topics: Array<{ id: string; title: string }> };
export type QuestionBankAdmin = {
  subject: string;
  title: string;
  template_count: number;
  publication_status: "draft" | "published";
  source: "built-in" | "imported";
  replaces_builtin: boolean;
  template_summaries: Array<{
    id: string;
    version: number;
    type: string;
    skill: string;
    difficulty: number | null;
    fact_count: number;
    variant_count: number;
    generation_space: number;
    variants: string[];
  }>;
  document: { generatorVersion: string; templates: Array<{ id: string; skill: string; difficulty: number; type: string }> } & Record<string, unknown>;
};
export type AdminBankPreview = { subject: string; seed: number; questions: Question[] };
export type WorksheetTopic = { subject: string; subject_title: string; id: string; title: string };

export type DemoSubject = "math" | "trivia" | "english" | "canadian-citizenship";
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
export type DemoWorksheetPreview = { subject_title: string; seed: number; questions: Question[] };
