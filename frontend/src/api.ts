import type { AdminBankPreview, AttemptResult, AuthSession, DemoResult, DemoSession, DemoWorksheetPreview, FamilyLearner, FamilyProgress, ImportError, Progress, QuestionBankAdmin, Reward, Session, Subject, User, WorksheetTopic } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("rabbit_token");
  const response = await fetch(url, { ...options, headers: { ...(options?.body ? JSON_HEADERS : {}), ...options?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) {
    if (response.status === 401 && token) { sessionStorage.removeItem("rabbit_token"); window.dispatchEvent(new Event("rabbit:unauthorized")); }
    const payload: unknown = await response.json().catch(() => null);
    const detail = payload && typeof payload === "object" && "detail" in payload ? payload.detail : null;
    const validationMessage = Array.isArray(detail) && detail[0] && typeof detail[0] === "object" && "msg" in detail[0] && typeof detail[0].msg === "string"
      ? detail[0].msg
      : null;
    const structuredDetail = detail && !Array.isArray(detail) && typeof detail === "object" ? detail as { message?: string; errors?: ImportError[] } : null;
    const message = typeof detail === "string" ? detail : structuredDetail?.message ?? validationMessage ?? `Request failed (${response.status})`;
    const error = new Error(message) as Error & { details?: ImportError[] };
    error.details = structuredDetail?.errors;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function download(url: string, body: object): Promise<Blob> {
  const token = sessionStorage.getItem("rabbit_token");
  const response = await fetch(url, { method: "POST", headers: { ...JSON_HEADERS, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  if (!response.ok) {
    if (response.status === 401 && token) { sessionStorage.removeItem("rabbit_token"); window.dispatchEvent(new Event("rabbit:unauthorized")); }
    const message = await response.json().catch(() => ({ detail: "Could not generate the PDF" }));
    throw new Error(typeof message.detail === "string" ? message.detail : "Could not generate the PDF");
  }
  return response.blob();
}

export const api = {
  login: (username: string, password: string) => request<AuthSession>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request<User>("/api/v1/auth/me"),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  createDemoSession: () => request<DemoSession>("/api/v1/demo-pack/sessions", { method: "POST" }),
  submitDemoAttempt: (sessionId: string, questionId: string, response: string | string[]) => request<DemoResult>("/api/v1/demo-pack/attempts", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ session_id: sessionId, question_id: questionId, response }),
  }),
  createDemoWorksheet: () => download("/api/v1/demo-pack/worksheet", {}),
  getSubjects: () => request<Subject[]>("/api/v1/subjects"),
  createSession: (learnerId: string, subject = "math.elementary", seed = Date.now()) => request<Session>("/api/v1/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ learner_id: learnerId, subject, seed, count: subject === "canadian-citizenship" ? 6 : 10 }),
  }),
  submitAttempt: (sessionId: string, questionId: string, choiceId: string, hintUsed: boolean, timeSpentMs: number) => request<AttemptResult>("/api/v1/attempts", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ session_id: sessionId, question_id: questionId, choice_id: choiceId, hint_used: hintUsed, time_spent_ms: timeSpentMs }),
  }),
  getOwnProgress: () => request<Progress>("/api/v1/learners/me/progress"),
  getParentLearnerProgress: (learnerId: string) => request<Progress>(`/api/v1/parents/learners/${learnerId}/progress`),
  getLearners: () => request<FamilyLearner[]>("/api/v1/parents/learners"),
  createLearner: (display_name: string, username: string, password: string) => request<User>("/api/v1/parents/learners", { method: "POST", body: JSON.stringify({ display_name, username, password }) }),
  resetLearner: (id: string, password: string) => request<void>(`/api/v1/parents/learners/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  parentImpersonateLearner: (id: string) => request<AuthSession>(`/api/v1/parents/learners/${id}/impersonate`, { method: "POST" }),
  saveLearningPreferences: (id: string, subject: string, topics: string[]) => request<User>(`/api/v1/parents/learners/${id}/learning-preferences`, { method: "PUT", body: JSON.stringify({ subject, topics }) }),
  getFamilyProgress: (parentId: string) => request<FamilyProgress>(`/api/v1/parents/families/${parentId}/progress`),
  saveReward: (learnerId: string, reward: Reward) => request<Reward>(`/api/v1/parents/learners/${learnerId}/reward`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(reward),
  }),
  getWorksheetTopics: () => request<WorksheetTopic[]>("/api/v1/parents/worksheet-topics"),
  createWorksheet: (subject: string, topic: string, count: number) => download("/api/v1/parents/worksheets", { subject, topic, count }),
  getManagedUsers: () => request<User[]>("/api/v1/admin/users"),
  updateManagedUser: (user: User) => request<User>(`/api/v1/admin/users/${user.id}`, { method: "PUT", body: JSON.stringify({ display_name: user.display_name, username: user.username, disabled: user.disabled }) }),
  createParent: (display_name: string, username: string, password: string) => request<User>("/api/v1/admin/parents", { method: "POST", body: JSON.stringify({ display_name, username, password }) }),
  adminReset: (id: string, password: string) => request<void>(`/api/v1/admin/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  impersonateUser: (id: string) => request<AuthSession>(`/api/v1/admin/users/${id}/impersonate`, { method: "POST" }),
  importQuestions: (document: object) => request<{ subject: string; templates_imported: number; status: "imported" | "replaced" }>("/api/v1/admin/questions/import", { method: "POST", body: JSON.stringify({ document }) }),
  getQuestionBanks: () => request<QuestionBankAdmin[]>("/api/v1/admin/question-banks"),
  previewQuestionBank: (subject: string, templateId: string, variantId: string, seed = Date.now()) => request<AdminBankPreview>(`/api/v1/admin/question-banks/${encodeURIComponent(subject)}/preview`, { method: "POST", body: JSON.stringify({ seed, template_id: templateId, variant_id: variantId }) }),
  publishQuestionBank: (subject: string) => request<{ subject: string; publication_status: "published" }>(`/api/v1/admin/question-banks/${encodeURIComponent(subject)}/publish`, { method: "POST" }),
  deleteQuestionBank: (subject: string) => request<void>(`/api/v1/admin/question-banks/${encodeURIComponent(subject)}`, { method: "DELETE" }),
  getQuestionSchema: () => request<object>("/api/v1/questions/schema"),
  validateQuestions: (document: object) => request<{ valid: true; templates_validated: number }>("/api/v1/questions/validate", { method: "POST", body: JSON.stringify({ document }) }),
  getContentSettings: () => request<{ include_drafts: boolean }>("/api/v1/admin/content"),
  saveContentSettings: (includeDrafts: boolean) => request<{ include_drafts: boolean }>("/api/v1/admin/content", {
    method: "PUT", body: JSON.stringify({ include_drafts: includeDrafts }),
  }),
};
