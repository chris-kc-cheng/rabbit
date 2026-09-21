import { MathBlock } from "./MathBlock";
import type { AttemptHistoryItem } from "./types";

function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function AttemptHistory({ attempts, title = "Question history" }: { attempts: AttemptHistoryItem[]; title?: string }) {
  return <section className="panel history-panel">
    <p className="eyebrow">Learning evidence</p><h2>{title}</h2>
    {!attempts.length ? <p className="empty">Completed questions will appear here.</p> : <div className="history-list">
      {attempts.map(attempt => <article className={attempt.correct ? "history-correct" : "history-incorrect"} key={`${attempt.question_id}-${attempt.answered_at}`}>
        <header><strong>{attempt.correct ? "Correct" : "Incorrect"}</strong><time dateTime={attempt.answered_at}>{new Date(attempt.answered_at).toLocaleString()}</time></header>
        <div className="history-prompt">{attempt.question.prompt.map((block, index) => block.type === "math" ? <MathBlock key={index} value={block.value} /> : <span key={index}>{block.value}</span>)}</div>
        <p><b>Chosen answer:</b> {attempt.selected_value}</p>
        {!attempt.correct && <p><b>Correct answer:</b> {attempt.correct_value}</p>}
        <footer>{duration(attempt.time_spent_ms)} spent · {attempt.hint_used ? "Hint used" : "No hint"}</footer>
      </article>)}
    </div>}
  </section>;
}
