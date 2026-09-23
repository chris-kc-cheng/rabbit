import { useMemo, useState } from "react";
import { MathBlock } from "./MathBlock";
import { QuestionVisual } from "./QuestionVisual";
import type { AttemptHistoryItem } from "./types";

function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function AttemptHistory({ attempts, title = "Question history" }: { attempts: AttemptHistoryItem[]; title?: string }) {
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
        <p><b>Chosen answer:</b> {attempt.selected_value}</p>
        {!attempt.correct && <p><b>Correct answer:</b> {attempt.correct_value}</p>}
        <footer>{duration(attempt.time_spent_ms)} spent · {attempt.hint_used ? "Hint used" : "No hint"}</footer>
      </article>)}
    </div>{pages > 1 && <nav className="history-pagination" aria-label="Question history pages"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><span aria-hidden="true">◀</span> Previous</button><span>Page {currentPage + 1} of {pages}</span><button disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Next <span aria-hidden="true">▶</span></button></nav>}</>}
  </section>;
}
