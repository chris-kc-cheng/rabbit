import { useEffect, useState } from "react";
import { api } from "./api";
import { DemoParentView } from "./DemoParentView";
import { MathBlock } from "./MathBlock";
import type { DemoQuestion, DemoResult, DemoSession, DemoSubject } from "./types";

const subjects: Array<{ id: DemoSubject; name: string; subtitle: string }> = [
  { id: "math", name: "Math Lab", subtitle: "See it, turn it, solve it" },
  { id: "trivia", name: "Trivia Show", subtitle: "Pick every answer that fits" },
  { id: "english", name: "Word Studio", subtitle: "Build and polish sentences" },
  { id: "canadian-citizenship", name: "Discover Canada", subtitle: "Explore Canada's history" },
];

function Triangle() {
  return <svg className="demo-triangle" viewBox="0 0 350 210" role="img" aria-label="Right triangle with a 30 degree angle, a 10 centimetre hypotenuse, and an unknown opposite side">
    <path d="M55 170 L290 170 L290 34 Z" fill="#e7f5ec" stroke="#206c6b" strokeWidth="4" strokeLinejoin="round" />
    <path d="M270 170 L270 150 L290 150" fill="none" stroke="#206c6b" strokeWidth="2" />
    <path d="M89 170 A34 34 0 0 0 84 153" fill="none" stroke="#ad493d" strokeWidth="2" />
    <text x="94" y="157">30°</text><text x="142" y="88">10 cm</text><text x="303" y="111">? cm</text>
  </svg>;
}

function Prism() {
  const [rotation, setRotation] = useState(-32);
  return <div className="prism-area">
    <div className="prism-scene" role="img" aria-label="Rotatable rectangular prism with edge lengths 2, 3, and 4 centimetres">
      <div className="prism-solid" style={{ transform: `rotateX(-22deg) rotateY(${rotation}deg)` }}>
        {(["front", "back", "left", "right", "top", "bottom"] as const).map(face => <div key={face} className={`prism-face ${face}`} />)}
      </div>
    </div>
    <div className="dimension-tags"><span>length 4 cm</span><span>width 2 cm</span><span>height 3 cm</span></div>
    <label className="rotation-control">Rotate prism <input type="range" min="-150" max="150" value={rotation} onChange={event => setRotation(Number(event.target.value))} /></label>
  </div>;
}

export function DemoPack() {
  const [experience, setExperience] = useState<"learner" | "parent">("learner");
  const [session, setSession] = useState<DemoSession | null>(null);
  const [subject, setSubject] = useState<DemoSubject>("math");
  const [questionId, setQuestionId] = useState("math-triangle-1");
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [results, setResults] = useState<Record<string, DemoResult>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { api.createDemoSession().then(data => {
    setSession(data);
    const ordering = data.questions.find(item => item.kind === "reorder");
    if (ordering) setResponses({ [ordering.id]: ordering.tiles?.map(tile => tile.id) ?? [] });
  }).catch((caught: Error) => setError(caught.message)); }, []);
  const questions = session?.questions.filter(question => question.subject === subject) ?? [];
  const question = questions.find(item => item.id === questionId) ?? questions[0];
  const response = question ? responses[question.id] : undefined;
  const result = question ? results[question.id] : undefined;
  const update = (value: string | string[]) => question && setResponses(old => ({ ...old, [question.id]: value }));
  const selectSubject = (id: DemoSubject) => { setSubject(id); setQuestionId(session?.questions.find(item => item.subject === id)?.id ?? ""); setError(""); };
  const moveTile = (from: number, to: number) => {
    if (!question || !Array.isArray(response) || to < 0 || to >= response.length) return;
    const next = [...response]; const [tile] = next.splice(from, 1); next.splice(to, 0, tile); update(next);
  };
  const submit = async () => {
    if (!session || !question || response === undefined || busy) return;
    setBusy(true); setError("");
    try { const answer = await api.submitDemoAttempt(session.id, question.id, response); setResults(old => ({ ...old, [question.id]: answer })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not check this answer"); }
    finally { setBusy(false); }
  };
  const canSubmit = typeof response === "string" ? response.trim().length > 0 : Array.isArray(response) && response.length > 0;

  return <main className={`demo-page demo-${subject}`}>
    <header className="demo-intro"><div><p className="eyebrow">Explore the prototype</p><h1>{experience === "learner" ? "Four ways to get curious." : "See the learning behind every try."}</h1><p>{experience === "learner" ? "Try a sample from each subject. Your answers are checked by Rabbit when you press Check answer." : "Preview how a parent can follow progress, spot practice signals, celebrate effort, and make an offline worksheet."}</p></div><div className="experience-switch" role="tablist" aria-label="Demo experience"><button role="tab" aria-selected={experience === "learner"} className={experience === "learner" ? "active" : ""} onClick={() => setExperience("learner")}>Learner view</button><button role="tab" aria-selected={experience === "parent"} className={experience === "parent" ? "active" : ""} onClick={() => setExperience("parent")}>Parent view</button></div></header>
    {experience === "parent" ? <DemoParentView /> : <>
    <div className="subject-switch" role="tablist" aria-label="Demo subjects">{subjects.map(item => <button key={item.id} type="button" role="tab" aria-selected={subject === item.id} className={subject === item.id ? "active" : ""} onClick={() => selectSubject(item.id)}><strong>{item.name}</strong><small>{item.subtitle}</small></button>)}</div>
    {!session ? <div className="card demo-loading">{error || "Preparing the activities…"}</div> : question && <div className="demo-layout">
      <nav className="demo-question-list" aria-label={`${subject} activities`}>{questions.map((item, index) => <button key={item.id} className={question.id === item.id ? "active" : ""} onClick={() => { setQuestionId(item.id); setError(""); }}><span>{index + 1}</span>{item.title}{results[item.id] && <b aria-label="completed">✓</b>}</button>)}</nav>
      <article className="card demo-card"><div className="demo-card-head"><p className="eyebrow">{subject} · {question.kind.replace("-", " ")}</p><h2>{question.title}</h2><p>{question.instruction}</p></div>
        {question.visual === "triangle" && <Triangle />}
        {question.visual === "prism" && <Prism />}
        {question.latex && <MathBlock value={question.latex} />}
        {question.image && <figure className="demo-photo"><img src={question.image} alt={question.image_alt ?? ""} /><figcaption>Look closely at each animal before you choose.</figcaption></figure>}
        {(question.kind === "single-select" || question.kind === "multi-select") && <div className="demo-choices" role={question.kind === "single-select" ? "radiogroup" : "group"} aria-label="Answer choices">{question.choices?.map((choice, index) => {
          const selected = Array.isArray(response) ? response.includes(choice.id) : response === choice.id;
          return <button key={choice.id} type="button" role={question.kind === "single-select" ? "radio" : "checkbox"} aria-checked={selected} className={selected ? "selected" : ""} disabled={Boolean(result)} onClick={() => update(question.kind === "single-select" ? choice.id : selected ? (response as string[]).filter(id => id !== choice.id) : [...(Array.isArray(response) ? response : []), choice.id])}><span>{String.fromCharCode(65 + index)}</span>{choice.label}</button>;
        })}</div>}
        {(question.kind === "fill-blank" || question.kind === "correction") && <label className="demo-answer-label">Your answer<input value={typeof response === "string" ? response : ""} onChange={event => update(event.target.value)} placeholder={question.placeholder} disabled={Boolean(result)} maxLength={200} /></label>}
        {question.kind === "reorder" && <Reorder question={question} order={Array.isArray(response) ? response : (question.tiles?.map(tile => tile.id) ?? [])} disabled={Boolean(result)} onChange={update} onMove={moveTile} dragId={dragId} setDragId={setDragId} />}
        {error && <p className="demo-error" role="alert">{error}</p>}
        {result && <div className={`demo-feedback ${result.correct ? "success" : "try-again"}`} role="status"><strong>{result.correct ? "Nicely done!" : "Good thinking—here’s the idea."}</strong><p>{result.feedback}</p></div>}
        <div className="demo-actions"><span>{result ? `${result.points_earned} points earned` : "Give it a try"}</span><button className="primary" disabled={!canSubmit || Boolean(result) || busy} onClick={submit}>{busy ? "Checking…" : result ? "Checked" : "Check answer"}</button></div>
      </article>
    </div>}</>}
  </main>;
}

function Reorder({ question, order, disabled, onChange, onMove, dragId, setDragId }: { question: DemoQuestion; order: string[]; disabled: boolean; onChange: (value: string[]) => void; onMove: (from: number, to: number) => void; dragId: string | null; setDragId: (id: string | null) => void }) {
  const labels = Object.fromEntries(question.tiles?.map(tile => [tile.id, tile.label]) ?? []);
  const move = (from: number, to: number) => { const next = [...order]; const [tile] = next.splice(from, 1); next.splice(to, 0, tile); onChange(next); };
  return <div className="reorder-area"><p>Put the words in order</p><div className="tile-row">{order.map((id, index) => <div key={id} className="word-tile" draggable={!disabled} onDragStart={() => setDragId(id)} onDragEnd={() => setDragId(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragId) move(order.indexOf(dragId), index); setDragId(null); }}><span>{labels[id]}</span><div><button type="button" aria-label={`Move ${labels[id]} left`} disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)}>←</button><button type="button" aria-label={`Move ${labels[id]} right`} disabled={disabled || index === order.length - 1} onClick={() => onMove(index, index + 1)}>→</button></div></div>)}</div></div>;
}
