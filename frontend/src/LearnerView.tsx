import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { QuestionVisual } from "./QuestionVisual";
import { MathBlock } from "./MathBlock";
import {
  correctAnswersNeeded,
  reachedAccuracyTarget,
  trophyForCompletedTrail,
} from "./raceRules";
import type { AttemptResult, Progress, Session, Subject } from "./types";

export function LearnerView({
  learnerId,
  onAttemptsChanged,
  onProgressChanged,
  defaultSubject = "math.elementary",
  loadProgress = api.getOwnProgress,
}: {
  learnerId: string;
  onAttemptsChanged: () => void;
  onProgressChanged?: (progress: Progress) => void;
  defaultSubject?: string;
  loadProgress?: () => Promise<Progress>;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [points, setPoints] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subject, setSubject] = useState(defaultSubject);
  const [progress, setProgress] = useState<Progress | null>(null);
  const questionStartedAt = useRef(Date.now());

  const refreshHistory = () =>
    loadProgress().then((nextProgress) => {
      setProgress(nextProgress);
      onProgressChanged?.(nextProgress);
      return nextProgress;
    });

  const start = async () => {
    setLoading(true);
    setError("");
    setIndex(0);
    setSelected(null);
    setResult(null);
    setPoints(0);
    setCorrectAnswers(0);
    setWrongAnswers(0);
    try {
      setSession(await api.createSession(learnerId, subject));
      questionStartedAt.current = Date.now();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not start practice",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void api.getSubjects().then(setSubjects);
  }, []);
  useEffect(() => {
    void refreshHistory();
  }, []);
  useEffect(() => {
    void start();
  }, [subject]);

  if (loading)
    return (
      <main className="card loading">
        <div className="spinner" />
        <p>Preparing your trail…</p>
      </main>
    );
  if (error || !session)
    return (
      <main className="card error">
        <h1>We hit a small bump.</h1>
        <p>{error}</p>
        <button className="primary" onClick={start}>
          Try again
        </button>
      </main>
    );
  const targetAccuracy = progress?.reward.target_accuracy ?? 70;
  const answered = index + (result ? 1 : 0);
  const accuracy = answered ? Math.round((correctAnswers / answered) * 100) : 0;
  const rabbitWon =
    index >= session.questions.length &&
    reachedAccuracyTarget(
      correctAnswers,
      session.questions.length,
      targetAccuracy,
    );

  if (index >= session.questions.length) {
    const trophy = trophyForCompletedTrail(
      correctAnswers,
      session.questions.length,
    );
    return (
      <main className="learner-column">
        <section
          className={`card finish race-finish ${rabbitWon ? "rabbit-winner" : "tortoise-winner"}`}
        >
          <div
            className={`winner-trophy ${trophy}`}
            role="img"
            aria-label={`${trophy} trophy`}
          >
            🏆
          </div>
          <img
            className="finish-mascot mascot-celebrate"
            src={rabbitWon ? "/rabbit-excited.png" : "/tortoise-steady.png"}
            alt={
              rabbitWon
                ? `The rabbit celebrating with the ${trophy} trophy`
                : "The tortoise celebrating with the silver trophy"
            }
          />
          <p className="eyebrow">Achievement unlocked</p>
          <h1>
            {trophy === "gold"
              ? "Perfect trail — Gold Trophy!"
              : rabbitWon
                ? "Rabbit wins a Silver Trophy!"
                : "Tortoise wins a Silver Trophy!"}
          </h1>
          <p>
            {trophy === "gold"
              ? `Every answer was correct — a perfect ${accuracy}% score!`
              : rabbitWon
                ? `You finished with ${accuracy}% accuracy and reached the ${targetAccuracy}% target. Keep growing toward gold!`
                : `You finished with ${accuracy}% accuracy. Steady effort earned silver; keep practicing toward a perfect gold!`}
          </p>
          <div className="trophy-points">
            <span>✨ EXP earned</span>
            <strong>+{points}</strong>
          </div>
          <button className="primary" onClick={start}>
            Practice a new trail
          </button>
        </section>
      </main>
    );
  }

  const question = session.questions[index];
  const submit = async () => {
    if (!selected) return;
    try {
      const answer = await api.submitAttempt(
        session.id,
        question.id,
        selected,
        hintVisible,
        Date.now() - questionStartedAt.current,
      );
      setResult(answer);
      setPoints((value) => value + answer.points_earned);
      if (answer.correct) setCorrectAnswers((value) => value + 1);
      else setWrongAnswers((value) => value + 1);
      onAttemptsChanged();
      await refreshHistory();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not check answer",
      );
    }
  };
  const next = () => {
    setIndex((value) => value + 1);
    setSelected(null);
    setResult(null);
    setHintVisible(false);
    questionStartedAt.current = Date.now();
  };

  return (
    <main className="learner-column">
      <div className="practice-toolbar">
        <div className="lesson-progress">
          <div>
            <span>Today&apos;s trail</span>
            <strong>
              {index + 1} / {session.questions.length}
            </strong>
          </div>
          <i>
            <b
              style={{
                width: `${(index / session.questions.length) * 100}%`,
              }}
            />
          </i>
        </div>
        <div className="subject-picker">
          <label htmlFor="subject">Practice subject</label>
          <select
            id="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
                {item.publication_status === "draft" ? " — Draft" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="practice-grid">
        <aside className="practice-race">
          <RaceTrack
            answered={answered}
            total={session.questions.length}
            correct={correctAnswers}
            wrong={wrongAnswers}
            target={targetAccuracy}
            sleeping={Boolean(result && !result.correct)}
          />
        </aside>
        <section className="practice-question">
          <article className="card question-card">
            <header className="question-header">
              <div>
                <p className="eyebrow">
                  Difficulty {question.difficulty} · +10 EXP for a correct
                  answer
                </p>
                <h1>{question.skill.split(".").slice(1).join(" ")}</h1>
              </div>
            </header>
            <section className="prompt">
              {question.prompt.map((block, blockIndex) =>
                block.type === "math" ? (
                  <MathBlock key={blockIndex} value={block.value} />
                ) : (
                  <p key={blockIndex}>{block.value}</p>
                ),
              )}
            </section>
            {question.visual && <QuestionVisual visual={question.visual} />}
            <div
              className="choices"
              role="radiogroup"
              aria-label="Answer choices"
            >
              {question.choices.map((choice, choiceIndex) => {
                const correct =
                  result && choice.id === result.correct_choice_id;
                const wrong =
                  result && choice.id === selected && !result.correct;
                return (
                  <button
                    key={choice.id}
                    role="radio"
                    aria-checked={selected === choice.id}
                    disabled={Boolean(result)}
                    className={`choice ${selected === choice.id ? "selected" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`}
                    onClick={() => setSelected(choice.id)}
                  >
                    <span>
                      {correct
                        ? "✓"
                        : wrong
                          ? "×"
                          : String.fromCharCode(65 + choiceIndex)}
                    </span>
                    {choice.value}
                  </button>
                );
              })}
            </div>
            {hintVisible && !result && (
              <aside className="hint">
                <img
                  className="feedback-mascot"
                  src="/rabbit-thinking.png"
                  alt=""
                />
                <span>
                  <strong>A little nudge</strong>
                  {question.hint}
                  <small>
                    Hints help you learn and are shared with your parent as
                    learning evidence.
                  </small>
                </span>
              </aside>
            )}
            {result && (
              <aside
                className={`feedback ${result.correct ? "positive" : "coaching"}`}
                role="status"
              >
                <img
                  className={`feedback-mascot ${result.correct ? "mascot-correct" : ""}`}
                  src={
                    result.correct
                      ? "/rabbit-excited.png"
                      : "/rabbit-supportive.png"
                  }
                  alt=""
                />
                <span>
                  <strong>
                    {result.correct
                      ? "Brilliant thinking!"
                      : "Good try — this is how we grow."}
                  </strong>
                  {result.feedback}
                </span>
              </aside>
            )}
          </article>
          <footer className="actions">
            <button
              className="quiet"
              disabled={Boolean(result)}
              onClick={() => setHintVisible(!hintVisible)}
            >
              💡 {hintVisible ? "Hide hint" : "Need a hint?"}
            </button>
            {result ? (
              <button className="primary" onClick={next}>
                Next question ▶
              </button>
            ) : (
              <button className="primary" disabled={!selected} onClick={submit}>
                Check answer ▶
              </button>
            )}
          </footer>
        </section>
        <aside className="practice-achievement">
          <Achievement
            answered={answered}
            correct={correctAnswers}
            total={session.questions.length}
          />
        </aside>
      </div>
    </main>
  );
}

export function AchievementSummary({ progress }: { progress: Progress | null }) {
  const achievements = progress?.achievements ?? {
    correct_answers: 0,
    silver_trophies: 0,
    gold_trophies: 0,
  };
  return (
    <section
      className="lifetime-achievements"
      aria-label="All-time achievements"
    >
      <span title="Correct answers">
        <i aria-hidden="true">✓</i>
        <strong>{achievements.correct_answers}</strong>
        <span className="sr-only"> correct answers</span>
      </span>
      <span title="Silver trophies">
        <i aria-hidden="true">🥈</i>
        <strong>{achievements.silver_trophies}</strong>
        <span className="sr-only"> silver trophies</span>
      </span>
      <span title="Gold trophies">
        <i aria-hidden="true">🥇</i>
        <strong>{achievements.gold_trophies}</strong>
        <span className="sr-only"> gold trophies</span>
      </span>
    </section>
  );
}

export function Achievement({
  answered,
  correct,
  total,
  compact = false,
}: {
  answered: number;
  correct: number;
  total: number;
  compact?: boolean;
}) {
  const perfectStillPossible = answered === correct;
  return (
    <section
      className={`achievement-card ${compact ? "compact" : ""}`}
      aria-label="Trail achievement"
    >
      <span
        className={`achievement-trophy ${perfectStillPossible ? "gold" : "silver"}`}
        aria-hidden="true"
      >
        🏆
      </span>
      <div>
        <span className="race-kicker">Your achievement</span>
        <strong>
          {perfectStillPossible
            ? "Gold is in reach"
            : "Silver trophy at the finish"}
        </strong>
        <small>
          {perfectStillPossible
            ? "Finish with every answer correct to earn gold."
            : "Every finished trail earns silver. Keep learning and finish strong!"}
        </small>
      </div>
      <span className="achievement-score">
        {correct}
        <small>/{total} correct</small>
      </span>
    </section>
  );
}

export function RaceTrack({
  answered,
  total,
  correct,
  wrong,
  target,
  sleeping,
}: {
  answered: number;
  total: number;
  correct: number;
  wrong: number;
  target: number;
  sleeping: boolean;
}) {
  const neededToWin = correctAnswersNeeded(total, target);
  const rabbitProgress = Math.min(1, correct / neededToWin);
  const tortoiseProgress = Math.min(1, answered / total);
  const sleepSeconds = 2 + wrong * 2;
  const position = (progress: number) =>
    ({
      "--race-x": `${progress * 65}%`,
      "--race-y": `${progress * 48}%`,
    }) as React.CSSProperties;
  return (
    <section
      className="race-card"
      aria-label={`Rabbit versus tortoise race. Accuracy target is ${target} percent or higher.`}
    >
      <header>
        <div>
          <span className="race-kicker">Rabbit vs. Tortoise</span>
          <strong>Race to the finish!</strong>
        </div>
        <span className="target-chip">Target: ≥ {target}%</span>
      </header>
      <div className="hill-track">
        <svg
          className="race-landscape"
          viewBox="0 0 500 240"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g className="race-cloud" transform="translate(52 38)">
            <circle cx="20" cy="16" r="14" />
            <circle cx="38" cy="12" r="20" />
            <circle cx="59" cy="18" r="15" />
            <rect x="20" y="16" width="39" height="17" rx="8" />
          </g>
          <g className="race-cloud" transform="translate(268 24) scale(.72)">
            <circle cx="20" cy="16" r="14" />
            <circle cx="38" cy="12" r="20" />
            <circle cx="59" cy="18" r="15" />
            <rect x="20" y="16" width="39" height="17" rx="8" />
          </g>
          <path className="far-hill" d="M0 126 Q104 83 205 111 T500 64 V240 H0Z" />
          <path className="near-hill" d="M0 172 Q112 132 224 111 Q326 91 500 72 V240 H0Z" />
          <g className="finish-flag" aria-label="Red finish flag">
            <path className="flag-pole" d="M444 76 V24" />
            <path className="flag-cloth" d="M444 25 H482 L471 38 L482 51 H444Z" />
          </g>
        </svg>
        <div
          className={`racer rabbit-racer ${sleeping ? "is-sleeping" : ""}`}
          style={
            {
              ...position(rabbitProgress),
              "--sleep-time": `${sleepSeconds}s`,
            } as React.CSSProperties
          }
        >
          <img
            src={sleeping ? "/rabbit-sleeping.png" : "/rabbit-encouraging.png"}
            alt={
              sleeping
                ? `Rabbit sleeping for ${sleepSeconds} seconds after a wrong answer`
                : "Rabbit racing uphill"
            }
          />
          {sleeping && (
            <span className="sleep-cloud">Zzz · {sleepSeconds}s</span>
          )}
        </div>
        <div
          className="racer tortoise-racer"
          style={position(tortoiseProgress)}
        >
          <img
            src="/tortoise-steady.png"
            alt="Tortoise walking steadily uphill"
          />
        </div>
      </div>
      <footer>
        <span>🐇 {correct} big hops</span>
        <span>🐢 steady every turn</span>
      </footer>
    </section>
  );
}
