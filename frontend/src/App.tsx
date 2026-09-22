import { useEffect, useState } from "react";
import { AdminView } from "./AdminView";
import { api } from "./api";
import { Landing, Login } from "./AuthViews";
import { DemoPack } from "./DemoPack";
import { Documentation } from "./Documentation";
import { LearnerView } from "./LearnerView";
import { ParentView } from "./ParentView";
import type { User } from "./types";

type PublicView = "landing" | "login" | "demo" | "docs";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<PublicView>(sessionStorage.getItem("rabbit_token") ? "login" : "landing");
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem("rabbit_token")));
  const [showDocs, setShowDocs] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("rabbit-color-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1b1817" : "#fff8f2");
    localStorage.setItem("rabbit-color-theme", theme);
  }, [theme]);
  useEffect(() => {
    const expired = () => { setUser(null); setView("login"); };
    window.addEventListener("rabbit:unauthorized", expired);
    if (sessionStorage.getItem("rabbit_token")) api.me().then(setUser).catch(() => setView("login")).finally(() => setChecking(false));
    return () => window.removeEventListener("rabbit:unauthorized", expired);
  }, []);
  const logout = async () => {
    try { await api.logout(); } catch { /* Token may already be expired. */ }
    sessionStorage.removeItem("rabbit_token"); setUser(null); setView("landing");
  };
  const toggleTheme = () => setTheme(current => current === "dark" ? "light" : "dark");
  const themeButton = <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-pressed={theme === "dark"} onClick={toggleTheme}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "Light" : "Dark"}</span></button>;

  if (checking) return <main className="auth-page"><div className="spinner" /><p>Opening your learning space…</p></main>;
  if (!user) return <div className="app-shell">
    <header className="topbar public-top"><button className="brand" onClick={() => setView("landing")}><img className="brand-logo" src="/rabbit-reading-logo.png" alt="" />rabbit</button><nav aria-label="Explore Rabbit"><button className={view === "landing" ? "active" : ""} onClick={() => setView("landing")}>Home</button><button className={view === "demo" ? "active" : ""} onClick={() => setView("demo")}>Demo</button><button className={view === "docs" ? "active" : ""} onClick={() => setView("docs")}>Docs</button></nav><div className="header-tools">{themeButton}<button className="primary header-login" onClick={() => setView("login")}>Log in</button></div></header>
    {view === "landing" ? <Landing onLogin={() => setView("login")} onDemo={() => setView("demo")} /> : view === "login" ? <Login onBack={() => setView("landing")} onSuccess={setUser} /> : view === "docs" ? <Documentation /> : <DemoPack />}
  </div>;
  return <div className="app-shell">
    <header className="topbar signed-in"><button className="brand" onClick={() => setShowDocs(false)}><img className="brand-logo" src="/rabbit-reading-logo.png" alt="" />rabbit</button><nav aria-label="Your Rabbit space"><button className={!showDocs ? "active" : ""} onClick={() => setShowDocs(false)}>Workspace</button><button className={showDocs ? "active" : ""} onClick={() => setShowDocs(true)}>Docs</button></nav><div className="header-tools">{themeButton}<div className="account"><span>Hi, <strong>{user.display_name}</strong></span><button className="quiet" onClick={logout}>Log out</button></div></div></header>
    {showDocs ? <Documentation /> : user.role === "admin" ? <AdminView /> : user.role === "parent" ? <ParentView refreshKey={0} /> : <div className="learner-layout"><aside className="trail"><p className="eyebrow">Your path</p><h2>Math Explorer</h2><ol><li className="done">✓ <span>Ready<small>Signed in</small></span></li><li className="active">✦ <span>Mixed practice<small>In progress</small></span></li></ol></aside><LearnerView learnerId={user.id} onAttemptsChanged={() => {}} /><aside className="coach"><img className="mascot" src="/rabbit-encouraging.png" alt="Rabbit giving an encouraging thumbs-up" /><div><strong>You&apos;ve got this!</strong><p>Every thoughtful try makes your learning stronger.</p></div></aside></div>}
  </div>;
}
