import { FormEvent, useState } from "react";
import { api } from "./api";
import type { User } from "./types";

export function Landing({ onLogin, onDemo }: { onLogin: () => void; onDemo: () => void }) {
  return <main className="landing">
    <section className="landing-hero"><div><p className="eyebrow">Learning that notices the effort</p><h1>Small steps.<br/><em>Bright progress.</em></h1><p>Rabbit gives independent learners supportive practice and gives families a clear view of what is clicking—and where a little more practice can help.</p><div className="hero-actions"><button className="primary demo-cta" onClick={onDemo}>Try the free demo →</button><button className="quiet login-link" onClick={onLogin}>Log in</button></div><small>Demo answers are not saved. Only reviewed, demo-enabled activities are available.</small></div>
      <div className="product-shot" role="img" aria-label="Preview of a Rabbit learning question and progress panel"><div className="shot-top"><b>rabbit</b><span>Today&apos;s trail · 4 of 10</span></div><div className="shot-card"><span className="shot-pill">Fractions</span><h2>What part of the garden is planted?</h2><div className="shot-fraction"><i/><i/><i/><i/></div><div className="shot-options"><b>¼</b><b>½</b><b>¾</b><b>⅓</b></div><p>★ Thoughtful tries grow strong minds.</p></div></div>
    </section><section className="feature-row"><article><b>01</b><h2>Practice with purpose</h2><p>Clear questions, useful hints, and explanations right when they matter.</p></article><article><b>02</b><h2>See the learning</h2><p>Families can review progress, exact answers, and recurring misconception evidence.</p></article><article><b>03</b><h2>Celebrate effort</h2><p>Optional family rewards turn steady practice into something to look forward to.</p></article></section>
  </main>;
}

export function Login({ onSuccess, onBack }: { onSuccess: (user: User) => void; onBack: () => void }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const auth = await api.login(username, password); sessionStorage.setItem("rabbit_token", auth.access_token); onSuccess(auth.user); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not log in"); } finally { setBusy(false); } };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><button type="button" className="quiet back" onClick={onBack}>← Back home</button><img src="/rabbit-reading-logo.png" alt=""/><p className="eyebrow">Welcome back</p><h1>Log in to Rabbit</h1><p>Your role takes you to the right learning space.</p><label>Username<input autoComplete="username" required minLength={3} value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy ? "Logging in…" : "Log in →"}</button></form></main>;
}
