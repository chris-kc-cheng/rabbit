import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { AttemptHistory } from "./AttemptHistory";
import type { FamilyLearner, Progress, Reward, WorksheetTopic } from "./types";

function duration(totalMs: number) {
  const minutes = Math.round(totalMs / 60000);
  if (minutes < 1) return totalMs ? "<1 min" : "0 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function streak(progress: Progress) {
  const days = new Set(progress.attempt_history.map(item => new Date(item.answered_at).toISOString().slice(0, 10)));
  if (!days.size) return 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let count = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) { count += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return count;
}

function ActivityChart({ progress }: { progress: Progress }) {
  const values = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (6 - index));
      return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString(undefined, { weekday: "narrow" }), count: 0 };
    });
    progress.attempt_history.forEach(attempt => { const day = days.find(item => item.key === attempt.answered_at.slice(0, 10)); if (day) day.count += 1; });
    return days;
  }, [progress.attempt_history]);
  const max = Math.max(1, ...values.map(item => item.count));
  return <figure className="activity-chart" aria-label="Questions completed over the last seven days">
    <figcaption>7-day activity</figcaption><div>{values.map(day => <span key={day.key}><i style={{ height: `${Math.max(6, day.count / max * 100)}%` }} title={`${day.count} questions`} /><small>{day.label}</small></span>)}</div>
  </figure>;
}

export function ParentView({ refreshKey }: { refreshKey: number }) {
  const [learners, setLearners] = useState<FamilyLearner[]>([]); const [openId, setOpenId] = useState(""); const [notice, setNotice] = useState(""); const [showAdd, setShowAdd] = useState(false);
  const [openTool, setOpenTool] = useState<"reward" | "worksheet" | "history" | null>(null);
  const [topics, setTopics] = useState<WorksheetTopic[]>([]); const [topicKey, setTopicKey] = useState(""); const [questionCount, setQuestionCount] = useState(10); const [generating, setGenerating] = useState(false);
  const [reward, setReward] = useState<Reward>({ enabled: false, target_accuracy: 70, reward: "A trip to the bookshop" });
  const refresh = async () => { const data = await api.getLearners(); setLearners(data); setOpenId(id => data.some(x => x.id === id) ? id : data[0]?.id ?? ""); };
  useEffect(() => { void refresh(); void api.getWorksheetTopics().then(data => { setTopics(data); setTopicKey(current => data.some(topic => `${topic.subject}:${topic.id}` === current) ? current : (data[0] ? `${data[0].subject}:${data[0].id}` : "")); }).catch(error => setNotice(error instanceof Error ? error.message : "Could not load worksheet topics")); }, [refreshKey]);
  const selected = learners.find(item => item.id === openId);
  useEffect(() => { setOpenTool(null); }, [openId]);
  useEffect(() => { if (selected) setReward(selected.progress.reward); }, [selected]);
  useEffect(() => { if (!showAdd) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setShowAdd(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [showAdd]);
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); try { await api.createLearner(String(data.get("name")), String(data.get("username")), String(data.get("password"))); form.reset(); setShowAdd(false); setNotice("Learner profile created."); await refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create learner"); } };
  const reset = async () => { if (!selected) return; const password = window.prompt(`New password for ${selected.display_name} (8+ characters)`); if (password) { try { await api.resetLearner(selected.id, password); setNotice("Password reset successfully."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not reset password"); } } };
  const save = async () => { if (selected) { setReward(await api.saveReward(selected.id, reward)); setNotice("Reward goal saved."); await refresh(); } };
  const generateWorksheet = async () => { const topic = topics.find(item => `${item.subject}:${item.id}` === topicKey); if (!topic) return; setGenerating(true); try { const blob = await api.createWorksheet(topic.subject, topic.id, questionCount); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${topic.title.toLowerCase().replaceAll(" ", "-")}-${questionCount}-questions.pdf`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setNotice("Worksheet and answer key downloaded."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not generate the worksheet"); } finally { setGenerating(false); } };

  return <main className="portal-page parent-dashboard"><header className="portal-hero"><div><p className="eyebrow">Family dashboard</p><h1>Learning at a glance</h1><p>See everyone together, then open a learner for the evidence behind their progress.</p></div><div className="family-count"><span>{learners.length}</span><small>{learners.length === 1 ? "learner" : "learners"}</small><button className="add-child" onClick={() => setShowAdd(true)} aria-label="Add a learner" title="Add a learner">＋</button></div></header>{notice && <p className="notice" role="status">{notice}</p>}
    <section className="children-accordion" aria-label="Learner progress">
      {!learners.length && <div className="panel empty-family"><span aria-hidden="true">◇</span><h2>No learner profiles yet</h2><p>Add a learner to begin seeing practice progress here.</p><button className="primary" onClick={() => setShowAdd(true)}>Add your first learner</button></div>}
      {learners.map(learner => { const progress = learner.progress; const isOpen = learner.id === openId; const totalTime = progress.attempt_history.reduce((sum, item) => sum + item.time_spent_ms, 0); const skillEvidence = Object.entries(progress.attempt_history.reduce<Record<string, { correct: number; total: number }>>((items, attempt) => { const item = items[attempt.skill] ?? { correct: 0, total: 0 }; item.total += 1; if (attempt.correct) item.correct += 1; items[attempt.skill] = item; return items; }, {})).map(([skill, evidence]) => ({ skill, ...evidence, accuracy: evidence.correct / evidence.total })).sort((a, b) => b.accuracy - a.accuracy); const strength = skillEvidence.find(item => item.total >= 2 && item.accuracy >= .8); const improvement = [...skillEvidence].reverse().find(item => item.total >= 2 && item.accuracy < .8); const skillName = (value: string) => value.split(".").slice(-2).join(" "); return <article className={`child-summary ${isOpen ? "open" : ""}`} key={learner.id}>
        <button className="child-summary-toggle" aria-expanded={isOpen} aria-controls={`child-${learner.id}`} onClick={() => setOpenId(isOpen ? "" : learner.id)}><span className="child-avatar" aria-hidden="true">{learner.display_name.slice(0, 1).toUpperCase()}</span><span className="child-name">{learner.display_name}<small>@{learner.username}</small></span><span className="summary-stat"><i>{progress.attempts}</i><small>questions</small></span><span className="summary-stat"><i>{Math.round(progress.accuracy * 100)}%</i><small>accuracy</small></span><span className="summary-stat"><i>{streak(progress)}</i><small>day streak</small></span><span className="summary-stat"><i>{duration(totalTime)}</i><small>time spent</small></span><span className="accordion-chevron" aria-hidden="true">▼</span></button>
        {isOpen && <div className="child-detail" id={`child-${learner.id}`}><div className="child-overview"><ActivityChart progress={progress} /><section className="progress-ring" style={{ "--progress": `${Math.round(progress.accuracy * 100) * 3.6}deg` } as React.CSSProperties}><div><span>{Math.round(progress.accuracy * 100)}%</span><small>accuracy</small></div><p>{progress.correct} of {progress.attempts} answers correct</p></section><section className="quick-evidence"><h3>Practice signals</h3>{Object.keys(progress.misconceptions).length ? Object.entries(progress.misconceptions).slice(0, 3).map(([name, count]) => <p key={name}><span>{count}×</span>{name.split(".").slice(-2).join(" ")}</p>) : <p className="empty">No recurring signals yet.</p>}</section></div>
          <div className="learning-highlights"><article className="strength-highlight"><span aria-hidden="true">★</span><div><small>Strength to celebrate</small><strong>{strength ? skillName(strength.skill) : "Effort is building"}</strong><p>{strength ? `${strength.correct} of ${strength.total} recent answers were correct.` : "More practice will reveal a growing strength."}</p></div></article><article className="practice-highlight"><span aria-hidden="true">▲</span><div><small>Helpful next focus</small><strong>{improvement ? skillName(improvement.skill) : "Keep exploring"}</strong><p>{improvement ? `${improvement.total - improvement.correct} of ${improvement.total} answers show an opportunity to practice.` : "No repeated area needs extra attention right now."}</p></div></article></div>
          <nav className="dashboard-tools" aria-label={`Tools for ${learner.display_name}`}><button aria-pressed={openTool === "history"} onClick={() => setOpenTool(openTool === "history" ? null : "history")}><span aria-hidden="true">▤</span>Answers</button><button aria-pressed={openTool === "reward"} onClick={() => setOpenTool(openTool === "reward" ? null : "reward")}><span aria-hidden="true">★</span>Reward</button><button aria-pressed={openTool === "worksheet"} onClick={() => setOpenTool(openTool === "worksheet" ? null : "worksheet")}><span aria-hidden="true">▣</span>Worksheet</button><button onClick={reset}><span aria-hidden="true">●</span>Access</button></nav>
          {openTool === "reward" && <section className="panel dashboard-tool-panel"><p className="eyebrow">Optional encouragement</p><h2>Accuracy reward</h2><label className="check"><input type="checkbox" checked={reward.enabled} onChange={event => setReward({ ...reward, enabled: event.target.checked })} /> Enable a family reward</label><label>Target accuracy (%)<input type="number" min="50" max="100" disabled={!reward.enabled} value={reward.target_accuracy} onChange={event => setReward({ ...reward, target_accuracy: Number(event.target.value) })} /></label><label>Present or experience<input disabled={!reward.enabled} maxLength={80} value={reward.reward} onChange={event => setReward({ ...reward, reward: event.target.value })} /></label><button className="primary full" onClick={save}>Save goal</button></section>}
          {openTool === "worksheet" && <section className="panel worksheet-panel dashboard-tool-panel"><p className="eyebrow">Offline practice</p><h2>Make a worksheet</h2><p className="empty">Includes a separate answer key with worked explanations.</p><div className="worksheet-fields"><label>Topic<select value={topicKey} onChange={event => setTopicKey(event.target.value)}>{topics.map(topic => <option value={`${topic.subject}:${topic.id}`} key={`${topic.subject}:${topic.id}`}>{topic.subject_title} · {topic.title}</option>)}</select></label><label>Questions<input type="number" min="1" max="50" value={questionCount} onChange={event => setQuestionCount(Math.max(1, Math.min(50, Number(event.target.value))))} /></label></div><button className="primary full" disabled={!topicKey || generating} onClick={generateWorksheet}>{generating ? "Building PDF…" : "Download PDF"}</button></section>}
          {openTool === "history" && <AttemptHistory attempts={progress.attempt_history} title={`${learner.display_name}'s question history`} />}
        </div>}
      </article>; })}
    </section>
    {showAdd && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAdd(false)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-child-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setShowAdd(false)} aria-label="Close">×</button><p className="eyebrow">New profile</p><h2 id="add-child-title">Add a learner</h2><form className="stack-form" onSubmit={create}><label>Child&apos;s display name<input name="name" autoFocus required /></label><label>Login username<input name="username" minLength={3} required /></label><label>Temporary password<input name="password" type="password" minLength={8} required /></label><button className="primary">Create learner</button></form></section></div>}
  </main>;
}
