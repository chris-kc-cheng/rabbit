import { useState } from "react";
import { api } from "./api";
import { TopicRadar } from "./TopicRadar";

export function DemoParentView({ onStartPractice }: { onStartPractice: () => void }) {
  const [rewardEnabled, setRewardEnabled] = useState(true);
  const [reward, setReward] = useState("Choose Friday's family movie");
  const [generating, setGenerating] = useState(false);
  const [openTool, setOpenTool] = useState<"history" | "reward" | "worksheet" | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [practiceTopics, setPracticeTopics] = useState(["Fractions", "Measurement", "Multiplication"]);

  const downloadWorksheet = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const blob = await api.createDemoWorksheet();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "demo-all-questions.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({ kind: "success", message: "Worksheet and answer key downloaded." });
    } catch (caught) {
      setNotice({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Could not make the worksheet",
      });
    } finally {
      setGenerating(false);
    }
  };

  return <main className="portal-page parent-dashboard demo-parent" aria-label="Parent dashboard preview">
    <header className="portal-hero"><div><p className="eyebrow">Family dashboard · Sample data</p><h1>Learning at a glance</h1><p>See everyone together, then open a learner for the evidence behind their progress.</p></div><div className="family-count"><span>2</span><small>learners</small><button className="add-child" aria-label="Add a learner" title="Add a learner">＋</button></div></header>
    <section className="children-accordion" aria-label="Learner progress">
      <article className="child-summary open">
        <button className="child-summary-toggle" aria-expanded="true"><span className="child-avatar" aria-hidden="true">M</span><span className="child-name">Malik<small>@malik</small></span><span className="summary-stat"><i>42</i><small>questions</small></span><span className="summary-stat"><i>81%</i><small>accuracy</small></span><span className="summary-stat"><i>4</i><small>day streak</small></span><span className="summary-stat"><i>18 min</i><small>time spent</small></span><span className="accordion-chevron" aria-hidden="true">▼</span></button>
        <div className="child-detail"><div className="child-overview">
          <figure className="activity-chart" aria-label="Questions completed over the last seven days"><figcaption>7-day activity</figcaption><div>{[35, 62, 18, 84, 48, 100, 72].map((height, index) => <span key={index}><i style={{ height: `${height}%` }} /><small>{["W", "T", "F", "S", "S", "M", "T"][index]}</small></span>)}</div></figure>
          <section className="progress-ring" style={{ "--progress": "292deg" } as React.CSSProperties}><div><span>81%</span><small>accuracy</small></div><p>34 of 42 answers correct</p></section>
          <section className="quick-evidence"><h3>Practice signals</h3><p><span>2×</span>multiply only the ones</p><p><span>1×</span>fraction denominator</p></section>
        </div>
        <div className="topic-insights"><TopicRadar evidence={[{ skill: "math.fractions.equivalent", correct: 7, total: 8, accuracy: .875 }, { skill: "math.measurement.perimeter", correct: 6, total: 8, accuracy: .75 }, { skill: "math.multiplication.two-digit", correct: 3, total: 7, accuracy: .43 }, { skill: "math.geometry.angles", correct: 4, total: 6, accuracy: .67 }, { skill: "math.decimals.place-value", correct: 5, total: 7, accuracy: .71 }]} /><div className="learning-highlights"><article className="strength-highlight"><span aria-hidden="true">★</span><div><small>Strength to celebrate</small><strong>Equivalent fractions</strong><p>7 of 8 recent answers were correct.</p></div></article><article className="practice-highlight"><span aria-hidden="true">▲</span><div><small>Helpful next focus</small><strong>Two-digit multiplication</strong><p>2 answers show an opportunity to practice.</p></div></article></div></div>
        <section className="next-bank topic-planner"><div className="topic-planner-main"><label>Next question bank<select aria-label="Default next question bank for Malik"><option>Elementary Mathematics</option><option>Discover Canada</option></select></label><fieldset><legend>Practice topics</legend>{["Fractions", "Measurement", "Multiplication", "Geometry", "Decimals"].map(topic => <label className="topic-choice" key={topic}><input type="checkbox" checked={practiceTopics.includes(topic)} onChange={event => setPracticeTopics(current => event.target.checked ? [...current, topic] : current.filter(item => item !== topic))} /> {topic}</label>)}</fieldset><button className="quiet save-topics">Save topic plan</button></div><button className="primary">View as Malik</button></section>
        <nav className="dashboard-tools" aria-label="Tools for Malik"><button aria-pressed={openTool === "history"} onClick={() => setOpenTool(openTool === "history" ? null : "history")}><span aria-hidden="true">▤</span>Answers</button><button aria-pressed={openTool === "reward"} onClick={() => setOpenTool(openTool === "reward" ? null : "reward")}><span aria-hidden="true">★</span>Reward</button><button aria-pressed={openTool === "worksheet"} onClick={() => setOpenTool(openTool === "worksheet" ? null : "worksheet")}><span aria-hidden="true">▣</span>Worksheet</button><button><span aria-hidden="true">●</span>Access</button></nav>
        {openTool === "history" && <section className="panel dashboard-tool-panel"><p className="eyebrow">Learning evidence</p><h2>Recent answers</h2><div className="evidence-list"><div><i className="pass">✓</i><span><strong>Equivalent fractions</strong><small>Answered 3/4 · No hint</small></span><time>Today</time></div><div><i className="practice">↗</i><span><strong>Two-digit multiplication</strong><small>Answered 245 · Used a hint</small></span><time>Today</time></div></div></section>}
        {openTool === "reward" && <section className="panel dashboard-tool-panel demo-reward-panel"><p className="eyebrow">Optional encouragement</p><h2>Accuracy reward</h2><label className="check"><input type="checkbox" checked={rewardEnabled} onChange={event => setRewardEnabled(event.target.checked)} /> Enable a family reward</label><label>Present or experience<input value={reward} disabled={!rewardEnabled} maxLength={80} onChange={event => setReward(event.target.value)} /></label><button className="primary full">Save goal</button></section>}
        {openTool === "worksheet" && <section className="panel worksheet-panel dashboard-tool-panel"><p className="eyebrow">Offline practice</p><h2>Make a worksheet</h2><p className="empty">Includes a separate answer key with worked explanations.</p><button className="primary full" disabled={generating} onClick={downloadWorksheet}>{generating ? "Building PDF…" : "Download PDF"}</button>{notice && <small className={notice.kind === "success" ? "download-notice" : "download-error"} role={notice.kind === "success" ? "status" : "alert"}>{notice.message}</small>}</section>}
        </div>
      </article>
      <article className="child-summary"><button className="child-summary-toggle" aria-expanded="false"><span className="child-avatar" aria-hidden="true">S</span><span className="child-name">Sofia<small>@sofia</small></span><span className="summary-stat"><i>27</i><small>questions</small></span><span className="summary-stat"><i>74%</i><small>accuracy</small></span><span className="summary-stat"><i>2</i><small>day streak</small></span><span className="summary-stat"><i>11 min</i><small>time spent</small></span><span className="accordion-chevron" aria-hidden="true">▼</span></button></article>
      <article className="child-summary open"><button className="child-summary-toggle" aria-expanded="true"><span className="child-avatar" aria-hidden="true">A</span><span className="child-name">Alex<small>You · parent learner</small></span><span className="summary-stat"><i>8</i><small>questions</small></span><span className="summary-stat"><i>88%</i><small>accuracy</small></span><span className="summary-stat"><i>1</i><small>day streak</small></span><span className="summary-stat"><i>6 min</i><small>time spent</small></span><span className="accordion-chevron" aria-hidden="true">▼</span></button><div className="child-detail"><section className="next-bank topic-planner"><div className="topic-planner-main"><p><strong>Practice on your own profile</strong></p><p className="empty">Your answers stay separate from each child&apos;s learning evidence.</p></div><button className="primary" onClick={onStartPractice}>Start my practice</button></section></div></article>
    </section>
  </main>;
}
