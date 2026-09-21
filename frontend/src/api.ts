import type { AttemptResult, AuthSession, DemoResult, DemoSession, FamilyLearner, ImportError, Reward, Session, User } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("rabbit_token");
  const response = await fetch(url, { ...options, headers: { ...(options?.body ? JSON_HEADERS : {}), ...options?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) {
    if (response.status === 401 && token) { sessionStorage.removeItem("rabbit_token"); window.dispatchEvent(new Event("rabbit:unauthorized")); }
    const message = await response.json().catch(() => ({ detail: "Request failed" }));
    const error = new Error(typeof message.detail === "string" ? message.detail : message.detail?.message ?? "Request failed") as Error & { details?: ImportError[] };
    error.details = message.detail?.errors;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) => request<AuthSession>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request<User>("/api/v1/auth/me"),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  createDemoSession: () => request<DemoSession>("/api/v1/demo-pack/sessions", { method: "POST" }),
  submitDemoAttempt: (sessionId: string, questionId: string, response: string | string[]) => request<DemoResult>("/api/v1/demo-pack/attempts", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ session_id: sessionId, question_id: questionId, response }),
  }),
  createSession: (learnerId: string, seed = Date.now()) => request<Session>("/api/v1/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ learner_id: learnerId, seed, count: 10 }),
  }),
  submitAttempt: (sessionId: string, questionId: string, choiceId: string) => request<AttemptResult>("/api/v1/attempts", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ session_id: sessionId, question_id: questionId, choice_id: choiceId }),
  }),
  getLearners: () => request<FamilyLearner[]>("/api/v1/parents/learners"),
  createLearner: (display_name: string, username: string, password: string) => request<User>("/api/v1/parents/learners", { method: "POST", body: JSON.stringify({ display_name, username, password }) }),
  resetLearner: (id: string, password: string) => request<void>(`/api/v1/parents/learners/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  saveReward: (learnerId: string, reward: Reward) => request<Reward>(`/api/v1/parents/learners/${learnerId}/reward`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(reward),
  }),
  getManagedUsers: () => request<User[]>("/api/v1/admin/users"),
  createParent: (display_name: string, username: string, password: string) => request<User>("/api/v1/admin/parents", { method: "POST", body: JSON.stringify({ display_name, username, password }) }),
  adminReset: (id: string, password: string) => request<void>(`/api/v1/admin/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  importQuestions: (document: object) => request<{ subject: string; templates_imported: number }>("/api/v1/admin/questions/import", { method: "POST", body: JSON.stringify({ document }) }),
};
