import { useEffect, useState } from "react";
import { api } from "./api";
import type { FamilyProgress, Reward } from "./types";

export function ParentView({ refreshKey }: { refreshKey: number }) {
  const [family, setFamily] = useState<FamilyProgress | null>(null);
  const [selectedId, setSelectedId] = useState("demo-learner");
  const [reward, setReward] = useState<Reward>({ enabled: false, target_accuracy: 80, reward: "A trip to the bookshop" });
  const [saved, setSaved] = useState(false);
  const load = () => api.getFamilyProgress().then(data => { setFamily(data); const learner = data.learners.find(item => item.id === selectedId) ?? data.learners[0]; if (learner) { setSelectedId(learner.id); setReward(learner.progress.reward); } });
  useEffect(() => { void load(); }, [refreshKey]);
  const learner = family?.learners.find(item => item.id === selectedId);
  const progress = learner?.progress;
  const chooseLearner = (id: string) => { const next = family?.learners.find(item => item.id === id); if (next) { setSelectedId(id); setReward(next.progress.reward); } };
  const save = async () => { setReward(await api.saveReward(selectedId, reward)); await load(); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };

  return <main className="parent-page">
    <header className="parent-heading"><div><p className="eyebrow">Parent preview</p><h1>Your family&apos;s learning snapshot</h1><p>See every child in one place, including accuracy, hint use, answers, and supportive learning evidence. This prototype has no secure family accounts yet.</p></div><span className="preview-badge">Demo data</span></header>
    <nav className="learner-tabs" aria-label="Children">{family?.learners.map(child => <button key={child.id} className={selectedId === child.id ? "active" : ""} onClick={() => chooseLearner(child.id)}><strong>{child.name}</strong><small>{child.progress.attempts} attempts · {Math.round(child.progress.accuracy * 100)}% accuracy</small></button>)}</nav>
    <h2 className="child-heading">{learner?.name ?? "Learner"}&apos;s progress</h2>
    <section className="metric-grid">
      <article><span>Accuracy</span><strong>{Math.round((progress?.accuracy ?? 0) * 100)}%</strong><small>{progress?.correct ?? 0} accurate answers from {progress?.attempts ?? 0} tries</small></article>
      <article><span>Hints used</span><strong>{progress?.hints_used ?? 0}</strong><small>a useful signal for future practice</small></article>
      <article><span>Accuracy points</span><strong>{progress?.points ?? 0}</strong><small>points celebrate accurate answers; hints are tracked separately</small></article>
    </section>
    <section className="parent-grid">
      <article className="panel"><p className="eyebrow">Learning evidence</p><h2>Recent answers</h2>
        {!progress?.recent_attempts.length ? <p className="empty">No practice yet. When {learner?.name ?? "your child"} answers a question, the details will appear here.</p> : <div className="attempt-list">{progress.recent_attempts.map(attempt => <div key={attempt.question_id}><i className={attempt.correct ? "pass" : "miss"}>{attempt.correct ? "✓" : "↗"}</i><span><strong>{attempt.skill.split(".").slice(1).join(" ")}</strong><small>Answered {attempt.selected_value} · {attempt.hint_used ? "Used a hint" : "No hint"}{attempt.misconception_id ? ` · Evidence: ${attempt.misconception_id}` : ""}</small></span></div>)}</div>}
      </article>
      <article className="panel"><p className="eyebrow">Optional encouragement</p><h2>Accuracy reward</h2><p className="panel-copy">Set a goal for careful work, not question volume. Hints remain positive learning tools and are tracked separately as practice evidence.</p>
        <label className="check"><input type="checkbox" checked={reward.enabled} onChange={event => setReward({...reward, enabled:event.target.checked})} /> Enable reward goal</label>
        <label>Target accuracy (%)<input type="number" min="50" max="100" disabled={!reward.enabled} value={reward.target_accuracy} onChange={event => setReward({...reward,target_accuracy:Number(event.target.value)})} /></label>
        <label>Reward or experience<input maxLength={80} disabled={!reward.enabled} value={reward.reward} onChange={event => setReward({...reward,reward:event.target.value})} /></label>
        <button className="primary full" onClick={save}>{saved ? "Saved ✓" : "Save goal"}</button>
      </article>
    </section>
  </main>;
}
