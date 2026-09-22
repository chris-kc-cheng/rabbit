import { FormEvent, useEffect, useState } from "react";
import { api } from "./api";
import type { ImportError, User } from "./types";

export function AdminView() {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const refresh = () => api.getManagedUsers().then(setAccounts);
  useEffect(() => { void refresh(); void api.getContentSettings().then(value => setIncludeDrafts(value.include_drafts)); }, []);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api.createParent(String(data.get("name")), String(data.get("username")), String(data.get("password")));
      form.reset(); setNotice("Parent account created."); await refresh();
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not create account"); }
  };
  const reset = async (user: User) => {
    const password = window.prompt(`New password for ${user.display_name} (8+ characters)`);
    if (!password) return;
    try { await api.adminReset(user.id, password); setNotice("Password reset. Existing login tokens for this account are now invalid."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not reset password"); }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setErrors([]);
    setNotice("");
    let document: object;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        setErrors([{ path: "$", message: "The top-level JSON value must be an object.", suggestion: "Upload a complete question-bank object containing schemaVersion, subject, and templates." }]);
        event.target.value = "";
        return;
      }
      document = parsed;
    } catch {
      setErrors([{ path: "$", message: "The file is not valid JSON.", suggestion: "Check commas, quotes, and brackets, then try again." }]);
      event.target.value = "";
      return;
    }
    try {
      const result = await api.importQuestions(document);
      setNotice(`Imported ${result.templates_imported} templates for ${result.subject}.`);
    } catch (caught) {
      const error = caught as Error & { details?: ImportError[] };
      const message = caught instanceof Error ? caught.message : "Import failed";
      setNotice(message);
      setErrors(error.details ?? [{ path: "$", message, suggestion: "Resolve the server-reported import conflict or validation problem, then upload the bank again." }]);
    }
    event.target.value = "";
  };
  const updateDrafts = async (enabled: boolean) => {
    try { const value = await api.saveContentSettings(enabled); setIncludeDrafts(value.include_drafts); setNotice(value.include_drafts ? "Draft subjects are visible to learners." : "Draft subjects are hidden from learners."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not update draft visibility"); }
  };

  return <main className="portal-page">
    <header className="portal-hero"><div><p className="eyebrow">Administration</p><h1>People &amp; question banks</h1><p>Create parent access, help families regain access, and validate reviewed content.</p></div></header>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="portal-grid">
      <section className="panel"><h2>Create a parent</h2><form onSubmit={create} className="stack-form"><label>Display name<input name="name" required /></label><label>Username<input name="username" minLength={3} required /></label><label>Temporary password<input name="password" type="password" minLength={8} required /></label><button className="primary">Create parent</button></form></section>
      <section className="panel"><h2>Parent &amp; learner accounts</h2>{accounts.length === 0 ? <p className="empty">No family accounts yet.</p> : <div className="account-list">{accounts.map(user => <div key={user.id}><span><strong>{user.display_name}</strong><small>{user.role} · @{user.username}</small></span><button className="quiet" onClick={() => reset(user)}>Reset password</button></div>)}</div>}</section>
      <section className="panel admin-panel"><div><h2>Draft questions</h2><p className="panel-copy">Discover Canada is a draft question bank. Choose whether learners can see it during review.</p></div><label className="toggle"><input type="checkbox" checked={includeDrafts} onChange={event => void updateDrafts(event.target.checked)} /><span>{includeDrafts ? "Visible to learners" : "Hidden from learners"}</span></label></section>
      <section className="panel import-panel"><p className="eyebrow">Schema v2</p><h2>Import questions</h2><p className="panel-copy">Rabbit validates the bank against the schema and generates sample questions before importing it into this server process.</p><label className="file-drop">Choose JSON file<input type="file" accept="application/json,.json" onChange={upload} /></label>{errors.length > 0 && <div className="validation-errors"><h3>What needs attention</h3>{errors.map((error, index) => <article key={index}><code>{error.path}</code><strong>{error.message}</strong><p>Potential fix: {error.suggestion}</p></article>)}</div>}</section>
    </div>
  </main>;
}
