import { useEffect, useState } from "react";
import { api } from "./api";
import type { Progress, Reward } from "./types";

export function ParentView({ refreshKey }: { refreshKey: number }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [reward, setReward] = useState<Reward>({ enabled: false, target_points: 200, reward: "A trip to the bookshop" });
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.getProgress().then((data) => { setProgress(data); setReward(data.reward); }); }, [refreshKey]);
  const save = async () => { setReward(await api.saveReward(reward)); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };

  return <main className="parent-page">
    <header className="parent-heading"><div><p className="eyebrow">Parent preview</p><h1>Chloe&apos;s learning snapshot</h1><p>This prototype report uses this server process only. Authentication and durable family accounts are not implemented yet.</p></div><span className="preview-badge">Demo data</span></header>
    <section className="metric-grid">
      <article><span>Questions tried</span><strong>{progress?.attempts ?? 0}</strong><small>this demo session</small></article>
      <article><span>Correct answers</span><strong>{progress?.correct ?? 0}</strong><small>{Math.round((progress?.accuracy ?? 0) * 100)}% accuracy</small></article>
      <article><span>Points earned</span><strong>{progress?.points ?? 0}</strong><small>effort is always celebrated</small></article>
    </section>
    <section className="parent-grid">
      <article className="panel"><p className="eyebrow">Learning evidence</p><h2>Recent attempts</h2>
        {!progress?.recent_attempts.length ? <p className="empty">Complete a learner question to see evidence here.</p> : <div className="attempt-list">{progress.recent_attempts.map((attempt) => <div key={attempt.question_id}><i className={attempt.correct ? "pass" : "miss"}>{attempt.correct ? "✓" : "↗"}</i><span><strong>{attempt.skill.split(".").slice(1).join(" ")}</strong><small>Answered {attempt.selected_value}{attempt.misconception_id ? ` · ${attempt.misconception_id}` : ""}</small></span></div>)}</div>}
      </article>
      <article className="panel"><p className="eyebrow">Optional encouragement</p><h2>Family reward goal</h2><p className="panel-copy">Choose a positive experience or present. Earned points are never removed.</p>
        <label className="check"><input type="checkbox" checked={reward.enabled} onChange={(e) => setReward({...reward, enabled:e.target.checked})} /> Enable reward goal</label>
        <label>Target points<input type="number" min="50" max="10000" step="10" disabled={!reward.enabled} value={reward.target_points} onChange={(e) => setReward({...reward,target_points:Number(e.target.value)})} /></label>
        <label>Reward or experience<input maxLength={80} disabled={!reward.enabled} value={reward.reward} onChange={(e) => setReward({...reward,reward:e.target.value})} /></label>
        <button className="primary full" onClick={save}>{saved ? "Saved ✓" : "Save goal"}</button>
      </article>
    </section>
  </main>;
}
