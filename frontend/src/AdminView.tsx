import { useEffect, useState } from "react";
import { api } from "./api";

export function AdminView({ onChanged }: { onChanged: () => void }) {
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => { void api.getContentSettings().then(value => setIncludeDrafts(value.include_drafts)); }, []);
  const update = async (enabled: boolean) => {
    setIncludeDrafts(enabled);
    await api.saveContentSettings(enabled);
    onChanged(); setSaved(true); window.setTimeout(() => setSaved(false), 1800);
  };
  return <main className="admin-page"><header className="parent-heading"><div><p className="eyebrow">Administration</p><h1>Content visibility</h1><p>Control whether curriculum drafts appear in learner subject choices. Draft content is clearly labelled and should remain review-only.</p></div><span className="preview-badge">Prototype</span></header>
    <article className="panel admin-panel"><div><h2>Draft questions</h2><p className="panel-copy">Discover Canada is currently a draft question bank. Turn this off to show only human-reviewed, published banks.</p></div><label className="toggle"><input type="checkbox" checked={includeDrafts} onChange={event => void update(event.target.checked)} /><span>{includeDrafts ? "Visible to learners" : "Hidden from learners"}</span></label>{saved && <p className="saved" role="status">Setting saved ✓</p>}</article>
  </main>;
}
