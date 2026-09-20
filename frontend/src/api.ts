import type { AttemptResult, Progress, Reward, Session } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(message.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export const api = {
  createSession: (seed = Date.now()) => request<Session>("/api/v1/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ learner_id: "demo-learner", seed, count: 10 }),
  }),
  submitAttempt: (sessionId: string, questionId: string, choiceId: string) => request<AttemptResult>("/api/v1/attempts", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ session_id: sessionId, question_id: questionId, choice_id: choiceId }),
  }),
  getProgress: () => request<Progress>("/api/v1/parents/learners/demo-learner/progress"),
  saveReward: (reward: Reward) => request<Reward>("/api/v1/parents/learners/demo-learner/reward", {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(reward),
  }),
};
