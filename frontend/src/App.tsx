import { useState } from "react";
import { LearnerView } from "./LearnerView";
import { ParentView } from "./ParentView";

export default function App() {
  const [view, setView] = useState<"learner" | "parent">("learner");
  const [refreshKey, setRefreshKey] = useState(0);
  const [secret, setSecret] = useState(false);
  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setSecret(!secret)} aria-label="Rabbit logo — try listening"><span className="rabbit-mark"><i/><i/><b>•ᴗ•</b></span>rabbit</button>
      <nav aria-label="Choose experience"><button className={view === "learner" ? "active" : ""} onClick={() => setView("learner")}>Learner</button><button className={view === "parent" ? "active" : ""} onClick={() => setView("parent")}>Parent preview</button></nav>
      <div className="points">◆ <strong>Practice with purpose</strong></div></header>
    {view === "learner" ? <div className="learner-layout"><aside className="trail"><p className="eyebrow">Your path</p><h2>Math Explorer</h2><ol><li className="done">✓ <span>Warm-up<small>Complete</small></span></li><li className="active">✦ <span>Mixed practice<small>In progress</small></span></li><li>3 <span>Challenge<small>Up next</small></span></li></ol></aside><LearnerView onAttemptsChanged={() => setRefreshKey((key) => key + 1)} /><aside className="coach"><button className="mascot" onClick={() => setSecret(!secret)} aria-label="Ask Rabbit why it is listening"><i/><i/><b>• ᴗ •</b></button><div><strong>{secret ? "I’m all ears!" : "You’ve got this!"}</strong><p>{secret ? "Rabbit listens carefully in class — that’s how the project got its name." : "Every thoughtful try makes your math brain stronger."}</p></div></aside></div> : <ParentView refreshKey={refreshKey} />}
    {secret && <div className="toast" role="status">🐰 <span><strong>Rabbit is all ears.</strong> It listens carefully in class.</span></div>}
  </div>;
}
