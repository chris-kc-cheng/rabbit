import { useMemo, useState } from "react";
import { MathBlock } from "./MathBlock";
import { QuestionVisual } from "./QuestionVisual";
import type { AttemptHistoryItem } from "./types";

function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function AttemptHistory({ attempts, title = "Question history", showAnswers = true }: { attempts: AttemptHistoryItem[]; title?: string; showAnswers?: boolean }) {
  const [period, setPeriod] = useState<"all" | "7" | "30">("all");
  const [result, setResult] = useState<"all" | "wrong" | "correct">("all");
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const filtered = useMemo(() => {
    const cutoff = period === "all" ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return attempts.filter(attempt => (cutoff === 0 || new Date(attempt.answered_at).getTime() >= cutoff)
      && (result === "all" || (result === "correct" ? attempt.correct : !attempt.correct)));
  }, [attempts, period, result]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const changePeriod = (value: typeof period) => { setPeriod(value); setPage(0); };
  const changeResult = (value: typeof result) => { setResult(value); setPage(0); };

  return <section className="panel history-panel">
    <p className="eyebrow">Learning evidence</p><h2>{title}</h2>
    {!!attempts.length && <div className="history-controls"><label>When<select value={period} onChange={event => changePeriod(event.target.value as typeof period)}><option value="all">All days</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label><div role="group" aria-label="Filter by answer result"><button className={result === "all" ? "active" : ""} onClick={() => changeResult("all")}>All</button><button className={result === "wrong" ? "active" : ""} onClick={() => changeResult("wrong")}>Needs practice</button><button className={result === "correct" ? "active" : ""} onClick={() => changeResult("correct")}>Correct</button></div><span>{filtered.length} {filtered.length === 1 ? "answer" : "answers"}</span></div>}
    {!attempts.length ? <p className="empty">Completed questions will appear here.</p> : !filtered.length ? <p className="empty">No answers match these filters. Try another view.</p> : <><div className="history-list">
      {visible.map(attempt => <article className={attempt.correct ? "history-correct" : "history-incorrect"} key={`${attempt.question_id}-${attempt.answered_at}`}>
        <header><strong>{attempt.correct ? "Correct" : "Incorrect"}</strong><time dateTime={attempt.answered_at}>{new Date(attempt.answered_at).toLocaleString()}</time></header>
        <div className="history-prompt">{attempt.question.prompt.map((block, index) => block.type === "math" ? <MathBlock key={index} value={block.value} /> : <span key={index}>{block.value}</span>)}</div>
        {attempt.question.visual && <QuestionVisual visual={attempt.question.visual} />}
        {showAnswers && <p><b>Chosen answer:</b> {attempt.selected_value}</p>}
        {showAnswers && !attempt.correct && <p><b>Correct answer:</b> {attempt.correct_value}</p>}
        <footer>{duration(attempt.time_spent_ms)} spent · {attempt.hint_used ? "Hint used" : "No hint"}</footer>
      </article>)}
    </div>{pages > 1 && <nav className="history-pagination" aria-label="Question history pages"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><span aria-hidden="true">◀</span> Previous</button><span>Page {currentPage + 1} of {pages}</span><button disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Next <span aria-hidden="true">▶</span></button></nav>}</>}
  </section>;
}

export function TestHistory({ attempts, title, onDelete }: { attempts: AttemptHistoryItem[]; title: string; onDelete: (sessionId: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState("");
  const tests = useMemo(() => {
    const grouped = new Map<string, AttemptHistoryItem[]>();
    attempts.forEach(attempt => grouped.set(attempt.session_id, [...(grouped.get(attempt.session_id) ?? []), attempt]));
    return [...grouped.entries()].map(([sessionId, answers]) => ({ sessionId, answers, completedAt: answers.reduce((latest, answer) => answer.answered_at > latest ? answer.answered_at : latest, "") }))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }, [attempts]);
  const days = useMemo(() => {
    const grouped = new Map<string, typeof tests>();
    tests.forEach(test => { const key = test.completedAt.slice(0, 10); grouped.set(key, [...(grouped.get(key) ?? []), test]); });
    return [...grouped.entries()];
  }, [tests]);
  const remove = async (sessionId: string) => {
    if (!window.confirm("Delete this whole test result? This cannot be undone.")) return;
    setDeleting(sessionId);
    try { await onDelete(sessionId); } finally { setDeleting(""); }
  };
  return <section className="panel history-panel test-history"><p className="eyebrow">Learning evidence</p><h2>{title}</h2>
    {!tests.length ? <p className="empty">Completed tests will appear here.</p> : days.map(([day, dayTests]) => <section className="history-day" key={day}>
      <h3><time dateTime={day}>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</time></h3>
      {dayTests.map((test, index) => { const correct = test.answers.filter(answer => answer.correct).length; return <details className="test-result" key={test.sessionId}>
        <summary><span><strong>Test {index + 1}</strong><small>{new Date(test.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {correct} of {test.answers.length} correct</small></span><span className="test-score">{Math.round(correct / test.answers.length * 100)}%</span></summary>
        <div className="history-list">{test.answers.map(answer => <article className={answer.correct ? "history-correct" : "history-incorrect"} key={answer.question_id}>
          <header><strong>{answer.correct ? "Correct" : "Needs practice"}</strong></header>
          <div className="history-prompt">{answer.question.prompt.map((block, blockIndex) => block.type === "math" ? <MathBlock key={blockIndex} value={block.value} /> : <span key={blockIndex}>{block.value}</span>)}</div>
          {answer.question.visual && <QuestionVisual visual={answer.question.visual} />}<p><b>Submitted:</b> {answer.selected_value}</p>{!answer.correct && <p><b>Correct answer:</b> {answer.correct_value}</p>}
        </article>)}</div>
        <button className="danger-button delete-test" disabled={deleting === test.sessionId} onClick={() => void remove(test.sessionId)}>{deleting === test.sessionId ? "Deleting…" : "Delete test result"}</button>
      </details>; })}
    </section>)}
  </section>;
}
