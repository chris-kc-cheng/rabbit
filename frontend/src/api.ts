import type { AttemptResult, DemoResult, DemoSession, FamilyProgress, Reward, Session, Subject } from "./types";

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
  createDemoSession: () => request<DemoSession>("/api/v1/demo-pack/sessions", { method: "POST" }),
  submitDemoAttempt: (sessionId: string, questionId: string, response: string | string[]) => request<DemoResult>("/api/v1/demo-pack/attempts", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ session_id: sessionId, question_id: questionId, response }),
  }),
  getSubjects: () => request<Subject[]>("/api/v1/subjects"),
  createSession: (subject = "math.elementary", seed = Date.now()) => request<Session>("/api/v1/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ learner_id: "demo-learner", subject, seed, count: subject === "canadian-citizenship" ? 6 : 10 }),
  }),
  submitAttempt: (sessionId: string, questionId: string, choiceId: string, hintUsed: boolean) => request<AttemptResult>("/api/v1/attempts", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ session_id: sessionId, question_id: questionId, choice_id: choiceId, hint_used: hintUsed }),
  }),
  getFamilyProgress: () => request<FamilyProgress>("/api/v1/parents/families/demo-family/progress"),
  saveReward: (learnerId: string, reward: Reward) => request<Reward>(`/api/v1/parents/learners/${learnerId}/reward`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(reward),
  }),
  getContentSettings: () => request<{ include_drafts: boolean }>("/api/v1/admin/content"),
  saveContentSettings: (includeDrafts: boolean) => request<{ include_drafts: boolean }>("/api/v1/admin/content", {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify({ include_drafts: includeDrafts }),
  }),
};
