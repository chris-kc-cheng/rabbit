import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { ImportError, QuestionBankAdmin, User } from "./types";

type Section = "overview" | "curriculum" | "users" | "settings";

export function AdminView() {
  const [section, setSection] = useState<Section>("overview");
  const [accounts, setAccounts] = useState<User[]>([]);
  const [banks, setBanks] = useState<QuestionBankAdmin[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const refreshUsers = () => api.getManagedUsers().then(setAccounts);
  const refreshBanks = async () => {
    const value = await api.getQuestionBanks();
    setBanks(value);
    setSelectedSubject(current => value.some(bank => bank.subject === current) ? current : value[0]?.subject ?? "");
  };
  useEffect(() => {
    void Promise.all([refreshUsers(), refreshBanks(), api.getContentSettings().then(value => setIncludeDrafts(value.include_drafts))]);
  }, []);
  const selectedBank = banks.find(bank => bank.subject === selectedSubject);
  const parentCount = accounts.filter(user => user.role === "parent").length;
  const learnerCount = accounts.filter(user => user.role === "learner").length;
  const draftCount = banks.filter(bank => bank.publication_status === "draft").length;
  const skills = useMemo(() => selectedBank ? new Set(selectedBank.document.templates.map(template => template.skill)).size : 0, [selectedBank]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    try { await api.createParent(String(data.get("name")), String(data.get("username")), String(data.get("password"))); form.reset(); setNotice("Parent account created."); await refreshUsers(); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not create account"); }
  };
  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editingUser) return;
    try { const saved = await api.updateManagedUser(editingUser); setEditingUser(null); setNotice(`${saved.display_name} was updated.`); await refreshUsers(); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not update account"); }
  };
  const reset = async (user: User) => {
    const password = window.prompt(`New password for ${user.display_name} (8+ characters)`); if (!password) return;
    try { await api.adminReset(user.id, password); setNotice("Password reset. Existing login tokens for this account are now invalid."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not reset password"); }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setErrors([]); setNotice("");
    let document: object;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("The top-level JSON value must be an object.");
      document = parsed;
    } catch (caught) {
      setErrors([{ path: "$", message: caught instanceof Error ? caught.message : "The file is not valid JSON.", suggestion: "Upload a complete question-bank JSON object." }]); event.target.value = ""; return;
    }
    try {
      const result = await api.importQuestions(document);
      setNotice(result.status === "replaced" ? `Updated the ${result.subject} draft with ${result.templates_imported} templates.` : `Imported ${result.templates_imported} templates for ${result.subject}.`);
      await refreshBanks(); setSelectedSubject(result.subject);
    } catch (caught) {
      const error = caught as Error & { details?: ImportError[] }; const message = caught instanceof Error ? caught.message : "Import failed"; setNotice(message);
      setErrors(error.details ?? [{ path: "$", message, suggestion: message.includes("built-in") && message.includes("published") ? "Use a new subject ID. Published curriculum stays immutable so learner history remains auditable." : message.includes("built-in") ? "Set publicationStatus to draft, import it, review it here, and then publish it." : message.includes("published") ? "Use a new subject ID for a new bank. Published banks stay immutable so learner history remains auditable." : "Open the existing draft and either publish or delete it, or upload a draft with the same subject to replace it." }]);
    }
    event.target.value = "";
  };
  const publish = async (bank: QuestionBankAdmin) => {
    if (!window.confirm(`Publish ${bank.title}? Published curriculum cannot be edited or deleted.`)) return;
    try { await api.publishQuestionBank(bank.subject); setNotice(`${bank.title} is now published and immutable.`); await refreshBanks(); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not publish bank"); }
  };
  const remove = async (bank: QuestionBankAdmin) => {
    const prompt = bank.replaces_builtin
      ? `Remove the imported “${bank.title}” draft? Rabbit will restore the bundled draft for this subject.`
      : `Delete the draft “${bank.title}”?`;
    if (!window.confirm(prompt)) return;
    try { await api.deleteQuestionBank(bank.subject); setNotice(bank.replaces_builtin ? `${bank.title} restored to its bundled draft.` : `${bank.title} draft deleted.`); await refreshBanks(); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not delete bank"); }
  };
  const updateDrafts = async (enabled: boolean) => {
    try { const value = await api.saveContentSettings(enabled); setIncludeDrafts(value.include_drafts); setNotice(value.include_drafts ? "Draft subjects are visible to learners." : "Draft subjects are hidden from learners."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not update draft visibility"); }
  };

  return <main className="admin-workspace">
    <aside className="admin-sidebar"><div><p className="eyebrow">Rabbit admin</p><h1>Control room</h1></div><nav aria-label="Administration sections">
      {([['overview','Overview','⌂'],['curriculum','Curriculum','▤'],['users','People','♙'],['settings','Settings','⚙']] as const).map(([id,label,icon]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}><span aria-hidden="true">{icon}</span>{label}{id === "curriculum" && draftCount > 0 && <b>{draftCount}</b>}</button>)}
    </nav><p className="sidebar-help">Changes to published learning content are locked to protect learner history.</p></aside>
    <div className="admin-main">
      <header className="admin-header"><div><p className="eyebrow">Administration / {section}</p><h1>{section === "overview" ? "Good to see you" : section === "curriculum" ? "Curriculum library" : section === "users" ? "People & access" : "Learning settings"}</h1></div>{section === "curriculum" && <label className="admin-upload">＋ Import JSON<input type="file" accept="application/json,.json" onChange={upload} /></label>}</header>
      {notice && <p className="admin-notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></p>}
      {errors.length > 0 && <div className="validation-errors admin-errors"><h3>Import needs attention</h3>{errors.map((error, index) => <article key={index}><code>{error.path}</code><strong>{error.message}</strong><p>Potential fix: {error.suggestion}</p></article>)}</div>}

      {section === "overview" && <><section className="admin-stats"><article><span>Curriculum banks</span><strong>{banks.length}</strong><small>{draftCount} awaiting review</small></article><article><span>Parent accounts</span><strong>{parentCount}</strong><small>{accounts.filter(user => user.role === "parent" && !user.disabled).length} active</small></article><article><span>Learners</span><strong>{learnerCount}</strong><small>Across registered families</small></article></section><section className="admin-card"><div className="card-heading"><div><p className="eyebrow">Review queue</p><h2>Draft curriculum</h2></div><button className="quiet" onClick={() => setSection("curriculum")}>View library →</button></div>{banks.filter(bank => bank.publication_status === "draft").map(bank => <button className="review-row" key={bank.subject} onClick={() => { setSelectedSubject(bank.subject); setSection("curriculum"); }}><span className="bank-icon">{bank.title.slice(0,2).toUpperCase()}</span><span><strong>{bank.title}</strong><small>{bank.template_count} templates · {bank.subject}</small></span><i>Review</i></button>)}{draftCount === 0 && <p className="empty">No curriculum is waiting for review.</p>}</section></>}

      {section === "curriculum" && <div className="library-layout"><section className="admin-card bank-list"><div className="list-title"><h2>Question banks</h2><span>{banks.length}</span></div>{banks.map(bank => <button key={bank.subject} className={selectedSubject === bank.subject ? "selected" : ""} onClick={() => setSelectedSubject(bank.subject)}><span className="bank-icon">{bank.title.slice(0,2).toUpperCase()}</span><span><strong>{bank.title}</strong><small>{bank.template_count} templates</small></span><i className={`status ${bank.publication_status}`}>{bank.publication_status}</i></button>)}</section>{selectedBank && <section className="admin-card bank-detail"><header><div><span className="source-label">{selectedBank.source} bank</span><h2>{selectedBank.title}</h2><code>{selectedBank.subject}</code></div><i className={`status ${selectedBank.publication_status}`}>{selectedBank.publication_status}</i></header><div className="bank-facts"><div><span>Templates</span><strong>{selectedBank.template_count}</strong></div><div><span>Skills</span><strong>{skills}</strong></div><div><span>Generator</span><strong>{selectedBank.document.generatorVersion}</strong></div></div><div className="template-table"><div className="table-head"><span>Template</span><span>Skill</span><span>Level</span></div>{selectedBank.document.templates.map(template => <div key={template.id}><span><strong>{template.id}</strong><small>{template.type}</small></span><span>{template.skill}</span><span>{template.difficulty}</span></div>)}</div><footer>{selectedBank.source === "built-in" ? <p>Built-in content is read-only and updated through reviewed source releases.</p> : selectedBank.publication_status === "published" ? <p>Published content is locked to preserve reproducible learner records.</p> : <><button className="danger-button" onClick={() => void remove(selectedBank)}>Delete draft</button><button className="primary" onClick={() => void publish(selectedBank)}>Publish bank</button></>}</footer></section>}</div>}

      {section === "users" && <div className="people-layout"><section className="admin-card"><div className="list-title"><h2>Accounts</h2><span>{accounts.length}</span></div><div className="people-table"><div className="table-head"><span>Person</span><span>Role</span><span>Status</span><span></span></div>{accounts.map(user => <div key={user.id}><span><strong>{user.display_name}</strong><small>@{user.username}</small></span><span className="role-label">{user.role}</span><span className={`user-status ${user.disabled ? "disabled" : "active"}`}>{user.disabled ? "Paused" : "Active"}</span><span><button className="quiet" onClick={() => setEditingUser({...user})}>Edit</button><button className="quiet" onClick={() => void reset(user)}>Reset password</button></span></div>)}</div></section><section className="admin-card create-account"><p className="eyebrow">New account</p><h2>Create a parent</h2><form onSubmit={create} className="stack-form"><label>Display name<input name="name" required /></label><label>Username<input name="username" minLength={3} required /></label><label>Temporary password<input name="password" type="password" minLength={8} required /></label><button className="primary">Create parent</button></form></section></div>}

      {section === "settings" && <section className="admin-card settings-card"><div><p className="eyebrow">Learner access</p><h2>Draft curriculum visibility</h2><p>Draft banks are hidden by default. Turn this on only for supervised testing; drafts will become available to every signed-in learner.</p></div><label className="switch"><input type="checkbox" checked={includeDrafts} onChange={event => void updateDrafts(event.target.checked)} /><span aria-hidden="true" /><b>{includeDrafts ? "Visible" : "Hidden"}</b></label></section>}
    </div>
    {editingUser && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditingUser(null)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setEditingUser(null)} aria-label="Close">×</button><p className="eyebrow">Account details</p><h2 id="edit-user-title">Edit {editingUser.role}</h2><form className="stack-form" onSubmit={saveUser}><label>Display name<input value={editingUser.display_name} onChange={event => setEditingUser({...editingUser, display_name: event.target.value})} required /></label><label>Username<input value={editingUser.username} onChange={event => setEditingUser({...editingUser, username: event.target.value})} minLength={3} required /></label><label className="status-check"><input type="checkbox" checked={!editingUser.disabled} onChange={event => setEditingUser({...editingUser, disabled: !event.target.checked})} /><span><strong>Account active</strong><small>Paused accounts cannot sign in.</small></span></label><button className="primary">Save changes</button></form></section></div>}
  </main>;
}
