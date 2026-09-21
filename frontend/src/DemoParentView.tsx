import { useState } from "react";
import { api } from "./api";

export function DemoParentView() {
  const [rewardEnabled, setRewardEnabled] = useState(true);
  const [reward, setReward] = useState("Choose Friday's family movie");
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const downloadWorksheet = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const blob = await api.createDemoWorksheet();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rabbit-demo-all-questions.pdf";
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

  return <section className="demo-parent" aria-label="Parent dashboard preview">
    <div className="demo-parent-bar"><div><span className="demo-avatar">M</span><span><strong>Malik&apos;s learning</strong><small>Sample dashboard · illustrative data</small></span></div><select aria-label="Choose learner" defaultValue="Malik"><option>Malik</option><option>Sofia</option></select></div>
    <div className="demo-metrics"><article><span>Questions tried</span><strong>42</strong><small>+8 this week</small></article><article><span>Accuracy</span><strong>81%</strong><small>34 thoughtful answers</small></article><article><span>Practice streak</span><strong>4 days</strong><small>Personal best: 6</small></article><article><span>Points earned</span><strong>340</strong><small>60 to the family goal</small></article></div>
    <div className="demo-parent-grid">
      <article className="card demo-progress-panel"><div className="panel-title"><div><p className="eyebrow">Progress by skill</p><h2>Growing steadily</h2></div><span>Last 30 days</span></div><div className="skill-progress"><div><p><strong>Fractions</strong><span>88%</span></p><i><b style={{width:"88%"}} /></i><small>Ready for a little more challenge</small></div><div><p><strong>Multiplication</strong><span>76%</span></p><i><b style={{width:"76%"}} /></i><small>Building confidence</small></div><div><p><strong>Place value</strong><span>64%</span></p><i><b style={{width:"64%"}} /></i><small>Keep practicing this week</small></div></div></article>
      <article className="card demo-reward-panel"><p className="eyebrow">Optional encouragement</p><h2>Family reward</h2><label className="demo-toggle"><span><strong>Use a reward goal</strong><small>Celebrate effort together</small></span><input type="checkbox" checked={rewardEnabled} onChange={event => setRewardEnabled(event.target.checked)} /></label><label>Present or experience<input value={reward} disabled={!rewardEnabled} maxLength={80} onChange={event => setReward(event.target.value)} /></label><div className="reward-preview"><p><span>340 points</span><strong>400 goal</strong></p><i><b /></i><small>{rewardEnabled ? reward : "Reward goal is paused"}</small></div></article>
      <article className="card demo-evidence-panel"><div className="panel-title"><div><p className="eyebrow">Learning evidence</p><h2>Recent answers</h2></div><span>Latest 3</span></div><div className="evidence-list"><div><i className="pass">✓</i><span><strong>Equivalent fractions</strong><small>Answered 3/4 · No hint</small></span><time>Today</time></div><div><i className="practice">↗</i><span><strong>Two-digit multiplication</strong><small>Answered 245 · Used a hint</small></span><time>Today</time></div><div><i className="pass">✓</i><span><strong>Place value</strong><small>Answered 7,000 · No hint</small></span><time>Yesterday</time></div></div><div className="practice-signal"><span>◎</span><p><strong>A useful practice signal</strong>Malik chose the “multiply only the ones” route twice. Rabbit will offer another supportive example.</p></div></article>
      <article className="card demo-pdf-panel"><p className="eyebrow">Practice away from the screen</p><h2>Make a real PDF activity pack</h2><p>Download all 11 activities shown in the kid view: illustrated math, formulas, picture trivia, English, and Discover Canada questions, followed by an answer key.</p><button className="primary" disabled={generating} onClick={downloadWorksheet}>{generating ? "Building your PDF…" : "↓ Download all kid-view questions"}</button>{notice && <small className={notice.kind === "success" ? "download-notice" : "download-error"} role={notice.kind === "success" ? "status" : "alert"}>{notice.kind === "success" ? "✓" : "!"} {notice.message}</small>}</article>
    </div>
  </section>;
}
