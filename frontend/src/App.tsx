import { useEffect, useState } from "react";
import { AdminView } from "./AdminView";
import { api } from "./api";
import { Landing, Login } from "./AuthViews";
import { DemoPack } from "./DemoPack";
import { Documentation } from "./Documentation";
import { LearnerView } from "./LearnerView";
import { LearnerChrome } from "./LearnerChrome";
import { ParentView } from "./ParentView";
import type { User } from "./types";

type PublicView = "landing" | "login" | "demo" | "docs";
const ADMIN_TOKEN_KEY = "rabbit_admin_token";
const IMPERSONATED_USER_KEY = "rabbit_impersonated_user";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<PublicView>(sessionStorage.getItem("rabbit_token") ? "login" : "landing");
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem("rabbit_token")));
  const [showDocs, setShowDocs] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(() => {
    if (!sessionStorage.getItem(ADMIN_TOKEN_KEY)) return null;
    try { return JSON.parse(sessionStorage.getItem(IMPERSONATED_USER_KEY) ?? "null") as User | null; }
    catch { return null; }
  });
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
    const expired = () => { sessionStorage.removeItem(ADMIN_TOKEN_KEY); sessionStorage.removeItem(IMPERSONATED_USER_KEY); setImpersonatedUser(null); setUser(null); setView("login"); };
    window.addEventListener("rabbit:unauthorized", expired);
    if (sessionStorage.getItem("rabbit_token")) api.me().then(setUser).catch(() => setView("login")).finally(() => setChecking(false));
    return () => window.removeEventListener("rabbit:unauthorized", expired);
  }, []);
  const logout = async () => {
    try { await api.logout(); } catch { /* Token may already be expired. */ }
    sessionStorage.removeItem("rabbit_token"); sessionStorage.removeItem(ADMIN_TOKEN_KEY); sessionStorage.removeItem(IMPERSONATED_USER_KEY); setImpersonatedUser(null); setUser(null); setView("landing");
  };
  const startImpersonating = async (target: User) => {
    const adminToken = sessionStorage.getItem("rabbit_token");
    if (!adminToken) throw new Error("Your administrator session is no longer active");
    const auth = await api.impersonateUser(target.id);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    sessionStorage.setItem(IMPERSONATED_USER_KEY, JSON.stringify(auth.user));
    sessionStorage.setItem("rabbit_token", auth.access_token);
    setImpersonatedUser(auth.user); setUser(auth.user); setShowDocs(false);
  };
  const stopImpersonating = async () => {
    const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!adminToken) { await logout(); return; }
    sessionStorage.setItem("rabbit_token", adminToken);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY); sessionStorage.removeItem(IMPERSONATED_USER_KEY);
    setImpersonatedUser(null);
    try { setUser(await api.me()); setShowDocs(false); }
    catch { await logout(); }
  };
  const toggleTheme = () => setTheme(current => current === "dark" ? "light" : "dark");
  const themeButton = <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-pressed={theme === "dark"} onClick={toggleTheme}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "Light" : "Dark"}</span></button>;

  if (checking) return <main className="auth-page"><div className="spinner" /><p>Opening your learning space…</p></main>;
  if (!user) return <div className="app-shell">
    <header className="topbar public-top"><button className="brand" aria-label="Go to home" onClick={() => setView("landing")}><img className="brand-logo" src="/rabbit-reading-logo.png" alt="" /></button><nav aria-label="Explore"><button className={view === "landing" ? "active" : ""} onClick={() => setView("landing")}>Home</button><button className={view === "demo" ? "active" : ""} onClick={() => setView("demo")}>Demo</button><button className={view === "docs" ? "active" : ""} onClick={() => setView("docs")}>Docs</button></nav><div className="header-tools">{themeButton}<button className="primary header-login" onClick={() => setView("login")}>Log in</button></div></header>
    {view === "landing" ? <Landing onLogin={() => setView("login")} onDemo={() => setView("demo")} /> : view === "login" ? <Login onBack={() => setView("landing")} onSuccess={setUser} /> : view === "docs" ? <Documentation /> : <DemoPack />}
  </div>;
  return <div className="app-shell">
    {impersonatedUser && <div className="impersonation-banner" role="status"><span><strong>Administrator is viewing as user {impersonatedUser.display_name}</strong><small>@{impersonatedUser.username} · {impersonatedUser.role}</small></span><button type="button" onClick={() => void stopImpersonating()}>Return to administration</button></div>}
    <header className="topbar signed-in"><button className="brand" aria-label="Go to workspace" onClick={() => setShowDocs(false)}><img className="brand-logo" src="/rabbit-reading-logo.png" alt="" /></button><nav aria-label="Your learning space"><button className={!showDocs ? "active" : ""} onClick={() => setShowDocs(false)}>Workspace</button><button className={showDocs ? "active" : ""} onClick={() => setShowDocs(true)}>Docs</button></nav><div className="header-tools">{themeButton}<div className="account"><span>Hi, <strong>{user.display_name}</strong></span><button className="quiet" onClick={logout}>Log out</button></div></div></header>
    {showDocs ? <Documentation /> : user.role === "admin" ? <AdminView onImpersonate={startImpersonating} /> : user.role === "parent" ? <ParentView refreshKey={0} /> : <LearnerChrome><LearnerView learnerId={user.id} onAttemptsChanged={() => {}} /></LearnerChrome>}
  </div>;
}
