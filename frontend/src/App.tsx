import { useEffect, useState } from "react";
import { AdminView } from "./AdminView";
import { api } from "./api";
import { Activate, Landing, Login, Signup } from "./AuthViews";
import { DemoPack } from "./DemoPack";
import { Documentation } from "./Documentation";
import { LearnerView } from "./LearnerView";
import { LearnerChrome } from "./LearnerChrome";
import { ParentView } from "./ParentView";
import type { User } from "./types";

type PublicView = "landing" | "login" | "signup" | "activate" | "demo" | "docs";
const ORIGINAL_TOKEN_KEY = "rabbit_original_token";
const IMPERSONATED_USER_KEY = "rabbit_impersonated_user";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const activationToken = new URLSearchParams(window.location.search).get("activate");
  const [view, setView] = useState<PublicView>(activationToken ? "activate" : sessionStorage.getItem("rabbit_token") ? "login" : "landing");
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem("rabbit_token")));
  const [showDocs, setShowDocs] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(() => {
    if (!sessionStorage.getItem(ORIGINAL_TOKEN_KEY)) return null;
    try { return JSON.parse(sessionStorage.getItem(IMPERSONATED_USER_KEY) ?? "null") as User | null; }
    catch { return null; }
  });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("rabbit-color-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [wide, setWide] = useState(() => localStorage.getItem("rabbit-layout") === "wide");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1b1817" : "#fff8f2");
    localStorage.setItem("rabbit-color-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.layout = wide ? "wide" : "contained";
    localStorage.setItem("rabbit-layout", wide ? "wide" : "contained");
  }, [wide]);
  useEffect(() => {
    const expired = () => { sessionStorage.removeItem(ORIGINAL_TOKEN_KEY); sessionStorage.removeItem(IMPERSONATED_USER_KEY); setImpersonatedUser(null); setUser(null); setView("login"); };
    window.addEventListener("rabbit:unauthorized", expired);
    if (sessionStorage.getItem("rabbit_token")) api.me().then(setUser).catch(() => setView("login")).finally(() => setChecking(false));
    return () => window.removeEventListener("rabbit:unauthorized", expired);
  }, []);
  const logout = async () => {
    try { await api.logout(); } catch { /* Token may already be expired. */ }
    sessionStorage.removeItem("rabbit_token"); sessionStorage.removeItem(ORIGINAL_TOKEN_KEY); sessionStorage.removeItem(IMPERSONATED_USER_KEY); setImpersonatedUser(null); setUser(null); setView("landing");
  };
  const startImpersonating = async (target: User) => {
    const adminToken = sessionStorage.getItem("rabbit_token");
    if (!adminToken) throw new Error("Your administrator session is no longer active");
    const auth = await api.impersonateUser(target.id);
    sessionStorage.setItem(ORIGINAL_TOKEN_KEY, adminToken);
    sessionStorage.setItem(IMPERSONATED_USER_KEY, JSON.stringify(auth.user));
    sessionStorage.setItem("rabbit_token", auth.access_token);
    setImpersonatedUser(auth.user); setUser(auth.user); setShowDocs(false);
  };
  const startParentPractice = async (target: User) => {
    const parentToken = sessionStorage.getItem("rabbit_token");
    if (!parentToken) throw new Error("Your parent session is no longer active");
    const returnToken = sessionStorage.getItem(ORIGINAL_TOKEN_KEY) ?? parentToken;
    const auth = target.role === "parent"
      ? { access_token: parentToken, user: target }
      : await api.parentImpersonateLearner(target.id);
    sessionStorage.setItem(ORIGINAL_TOKEN_KEY, returnToken);
    sessionStorage.setItem(IMPERSONATED_USER_KEY, JSON.stringify(auth.user));
    sessionStorage.setItem("rabbit_token", auth.access_token);
    setImpersonatedUser(auth.user); setUser(auth.user); setShowDocs(false);
  };
  const stopImpersonating = async () => {
    const adminToken = sessionStorage.getItem(ORIGINAL_TOKEN_KEY);
    if (!adminToken) { await logout(); return; }
    sessionStorage.setItem("rabbit_token", adminToken);
    sessionStorage.removeItem(ORIGINAL_TOKEN_KEY); sessionStorage.removeItem(IMPERSONATED_USER_KEY);
    setImpersonatedUser(null);
    try { setUser(await api.me()); setShowDocs(false); }
    catch { await logout(); }
  };
  const toggleTheme = () => setTheme(current => current === "dark" ? "light" : "dark");
  const themeButton = <button className="icon-toggle" type="button" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-pressed={theme === "dark"} onClick={toggleTheme}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span></button>;
  const wideButton = <button className="icon-toggle" type="button" title={`${wide ? "Exit" : "Use"} wide mode`} aria-label={`${wide ? "Exit" : "Use"} wide mode`} aria-pressed={wide} onClick={() => setWide(value => !value)}><span aria-hidden="true">{wide ? "↔" : "⛶"}</span></button>;
  const displayButtons = <>{wideButton}{themeButton}</>;

  if (checking) return <main className="auth-page"><div className="spinner" /><p>Opening your learning space…</p></main>;
  if (!user) return <div className="app-shell">
    <header className="topbar public-top"><button className="brand" aria-label="Go to home" onClick={() => setView("landing")}><img className="brand-logo" src="/rabbit-reading-logo.png" alt="" /></button><nav aria-label="Explore"><button className={view === "landing" ? "active" : ""} onClick={() => setView("landing")}>Home</button><button className={view === "demo" ? "active" : ""} onClick={() => setView("demo")}>Demo</button><button className={view === "docs" ? "active" : ""} onClick={() => setView("docs")}>Docs</button></nav><div className="header-tools">{displayButtons}<button className="primary header-login" onClick={() => setView("login")}>Log in</button></div></header>
    {view === "landing" ? <Landing onLogin={() => setView("login")} onSignup={() => setView("signup")} onDemo={() => setView("demo")} /> : view === "login" ? <Login onBack={() => setView("landing")} onSuccess={setUser} /> : view === "signup" ? <Signup onBack={() => setView("landing")} onLogin={() => setView("login")} /> : view === "activate" && activationToken ? <Activate token={activationToken} onBack={() => setView("login")} onSuccess={setUser} /> : view === "docs" ? <Documentation /> : <DemoPack />}
  </div>;
  return <div className="app-shell">
    {impersonatedUser && <div className="impersonation-banner" role="status"><span><strong>Viewing the {impersonatedUser.role} experience as {impersonatedUser.display_name}</strong><small>@{impersonatedUser.username}</small></span><button type="button" onClick={() => void stopImpersonating()}>Return to dashboard</button></div>}
    <header className="topbar signed-in"><button className="brand" aria-label="Go to workspace" onClick={() => setShowDocs(false)}><img className="brand-logo" src="/rabbit-reading-logo.png" alt="" /></button><nav aria-label="Your learning space"><button className={!showDocs ? "active" : ""} onClick={() => setShowDocs(false)}>Workspace</button><button className={showDocs ? "active" : ""} onClick={() => setShowDocs(true)}>Docs</button></nav><div className="header-tools">{displayButtons}<div className="account"><span>Hi, <strong>{user.display_name}</strong></span><button className="quiet" onClick={logout}>Log out</button></div></div></header>
    {showDocs ? <Documentation /> : user.role === "admin" ? <AdminView onImpersonate={startImpersonating} /> : user.role === "parent" ? <ParentView refreshKey={0} onPractice={startParentPractice} /> : <LearnerChrome><LearnerView learnerId={user.id} defaultSubject={user.default_subject} onAttemptsChanged={() => {}} /></LearnerChrome>}
  </div>;
}
