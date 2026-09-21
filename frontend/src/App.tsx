import { useEffect, useState } from "react";
import { LearnerView } from "./LearnerView";
import { ParentView } from "./ParentView";
import { DemoPack } from "./DemoPack";
import { Documentation } from "./Documentation";

type AppView = "learner" | "parent" | "demo" | "admin" | "docs";

export default function App() {
  const [view, setView] = useState<AppView>("learner");
  const [refreshKey, setRefreshKey] = useState(0);
  const [secret, setSecret] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = window.localStorage.getItem("rabbit-color-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1b1817" : "#fff8f2");
    window.localStorage.setItem("rabbit-color-theme", theme);
  }, [theme]);

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setSecret(!secret)} aria-label="Rabbit logo — try listening"><img className="brand-logo" src="/rabbit-reading-logo.png" alt="" />rabbit</button>
      <nav aria-label="Choose experience"><button className={view === "learner" ? "active" : ""} onClick={() => setView("learner")}>Learner</button><button className={view === "demo" ? "active" : ""} onClick={() => setView("demo")}>Explore packs</button><button className={view === "parent" ? "active" : ""} onClick={() => setView("parent")}>Parent preview</button><button className={view === "docs" ? "active" : ""} onClick={() => setView("docs")}>Docs</button></nav>
      <div className="header-tools">
        <div className="points">◆ <strong>Practice with purpose</strong></div>
        <button
          className="theme-toggle"
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-pressed={theme === "dark"}
          onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
      </div>
    </header>
    {view === "learner" ? <div className="learner-layout">
      <aside className="trail"><p className="eyebrow">Your path</p><h2>Math Explorer</h2><ol><li className="done">✓ <span>Warm-up<small>Complete</small></span></li><li className="active">✦ <span>Mixed practice<small>In progress</small></span></li><li>3 <span>Challenge<small>Up next</small></span></li></ol></aside>
      <LearnerView onAttemptsChanged={() => setRefreshKey((key) => key + 1)} />
      <aside className="coach"><button className="mascot" onClick={() => setSecret(!secret)} aria-label="Ask Rabbit why it is listening"><img src="/rabbit-reading-logo.png" alt="" /></button><div><strong>{secret ? "I’m all ears!" : "You’ve got this!"}</strong><p>{secret ? "Rabbit listens carefully in class — that’s how the project got its name." : "Every thoughtful try makes your math brain stronger."}</p></div></aside>
    </div> : view === "demo" ? <DemoPack /> : view === "docs" ? <Documentation /> : <ParentView refreshKey={refreshKey} />}
    {secret && <div className="toast" role="status">🐰 <span><strong>Rabbit is all ears.</strong> It listens carefully in class.</span></div>}
  </div>;
}
