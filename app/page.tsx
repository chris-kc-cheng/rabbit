"use client";

import { useEffect, useMemo, useState } from "react";
import { FractionBar } from "@/components/FractionBar";
import { MathFormula } from "@/components/MathFormula";
import { ParentRewardSettings } from "@/components/ParentRewardSettings";
import { generateQuestions } from "@/lib/questions";
import { DEFAULT_REWARD_SETTINGS, normalizeRewardSettings, pointsProgress, REWARD_STORAGE_KEY, type RewardSettings } from "@/lib/rewards";

const letters = ["A", "B", "C", "D"];

export default function Home() {
  const questions = useMemo(() => generateQuestions(), []);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(3);
  const [finished, setFinished] = useState(false);
  const [parentSettingsOpen, setParentSettingsOpen] = useState(false);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(DEFAULT_REWARD_SETTINGS);
  const [earsListening, setEarsListening] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(REWARD_STORAGE_KEY);
    if (!saved) return;
    try {
      setRewardSettings(normalizeRewardSettings(JSON.parse(saved)));
    } catch {
      window.localStorage.removeItem(REWARD_STORAGE_KEY);
    }
  }, []);

  const question = questions[questionIndex];
  const isCorrect = selectedId === question.correctChoiceId;
  const selectedChoice = question.choices.find((choice) => choice.id === selectedId);
  const progress = finished ? 100 : (questionIndex / questions.length) * 100;
  const points = 120 + correctCount * 10;
  const rewardProgress = pointsProgress(points, rewardSettings.targetPoints);

  const saveRewardSettings = (settings: RewardSettings) => {
    setRewardSettings(settings);
    window.localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify(settings));
    setParentSettingsOpen(false);
  };

  const checkAnswer = () => {
    if (!selectedId || checked) return;
    setChecked(true);
    if (isCorrect) {
      setCorrectCount((count) => count + 1);
      setStreak((count) => count + 1);
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = () => {
    if (questionIndex === questions.length - 1) {
      setFinished(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelectedId(null);
    setChecked(false);
    setShowHint(false);
  };

  const restart = () => {
    setQuestionIndex(0);
    setSelectedId(null);
    setChecked(false);
    setShowHint(false);
    setCorrectCount(0);
    setStreak(3);
    setFinished(false);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" aria-label="Rabbit logo" onClick={() => setEarsListening((listening) => !listening)}>
          <span className="brand-mark" aria-hidden="true">
            <span className="ear ear-left" />
            <span className="ear ear-right" />
            <span className="face">•ᴗ•</span>
          </span>
          <span>rabbit</span>
        </button>

        <div className="trail-progress" aria-label={`${Math.round(progress)}% lesson progress`}>
          <div className="progress-label">
            <span>Today&apos;s trail</span>
            <strong>{finished ? questions.length : questionIndex + 1} / {questions.length}</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${Math.max(progress, 5)}%` }} /></div>
        </div>

        <div className="header-stats">
          <div className="stat"><span aria-hidden="true">🔥</span><strong>{streak}</strong><small>streak</small></div>
          <div className="stat"><span aria-hidden="true">◆</span><strong>{points}</strong><small>points</small></div>
          <button className="avatar" aria-label="Open parent reward settings" onClick={() => setParentSettingsOpen(true)}>P</button>
        </div>
      </header>

      <section className="lesson-layout">
        <aside className="path-card" aria-label="Lesson path">
          <p className="side-label">Your path</p>
          <h2>Math Explorer</h2>
          <div className="path-map">
            <div className="path-line" />
            <div className="path-step done"><span>✓</span><div><strong>Warm-up</strong><small>Complete</small></div></div>
            <div className="path-step active"><span>✦</span><div><strong>Mixed practice</strong><small>In progress</small></div></div>
            <div className="path-step"><span>3</span><div><strong>Challenge</strong><small>Up next</small></div></div>
          </div>
          <div className="weekly-card">
            <div><span>Weekly goal</span><strong>4 of 5 days</strong></div>
            <div className="mini-days" aria-label="Four of five weekly goal days complete">
              {[0, 1, 2, 3, 4].map((day) => <span className={day < 4 ? "filled" : ""} key={day} />)}
            </div>
          </div>
        </aside>

        <section className="main-column" id="main-card">
          {rewardSettings.enabled && (
            <div className={`reward-banner ${points >= rewardSettings.targetPoints ? "achieved" : ""}`}>
              <span className="reward-icon" aria-hidden="true">{points >= rewardSettings.targetPoints ? "★" : "◇"}</span>
              <div className="reward-copy">
                <small>{points >= rewardSettings.targetPoints ? "Goal reached — amazing effort!" : "Family reward goal"}</small>
                <strong>{rewardSettings.present}</strong>
                <div className="reward-track" aria-label={`${Math.round(rewardProgress)}% toward ${rewardSettings.present}`}><span style={{ width: `${rewardProgress}%` }} /></div>
              </div>
              <b>{points} / {rewardSettings.targetPoints}</b>
            </div>
          )}
          {finished ? (
            <div className="question-card finish-card">
              <div className="celebration" aria-hidden="true">★</div>
              <p className="eyebrow">Trail complete</p>
              <h1>You kept going!</h1>
              <p className="finish-copy">You solved {correctCount} of {questions.length} questions on your first try and earned {correctCount * 10} points.</p>
              <div className="result-grid">
                <div><strong>{correctCount}/{questions.length}</strong><span>correct</span></div>
                <div><strong>+{correctCount * 10}</strong><span>points</span></div>
                <div><strong>{Math.round((correctCount / questions.length) * 100)}%</strong><span>score</span></div>
              </div>
              <button className="primary-button restart-button" onClick={restart}>Practice again</button>
            </div>
          ) : (
            <>
              <article className="question-card">
                <div className="question-heading">
                  <div>
                    <p className="eyebrow">{question.eyebrow}</p>
                    <h1>{question.prompt}</h1>
                  </div>
                  <span className="skill-pill">{question.skill}</span>
                </div>

                {question.latex && <MathFormula latex={question.latex} />}
                {question.visual?.type === "fraction" && <FractionBar numerator={question.visual.numerator} denominator={question.visual.denominator} />}

                <div className="choices" role="radiogroup" aria-label="Answer choices">
                  {question.choices.map((choice, index) => {
                    const selected = selectedId === choice.id;
                    const revealCorrect = checked && choice.id === question.correctChoiceId;
                    const revealWrong = checked && selected && !isCorrect;
                    return (
                      <button
                        className={`choice ${selected ? "selected" : ""} ${revealCorrect ? "correct" : ""} ${revealWrong ? "wrong" : ""}`}
                        key={choice.id}
                        onClick={() => !checked && setSelectedId(choice.id)}
                        role="radio"
                        aria-checked={selected}
                        disabled={checked}
                      >
                        <span className="choice-letter">{revealCorrect ? "✓" : revealWrong ? "×" : letters[index]}</span>
                        <span>{choice.value}</span>
                      </button>
                    );
                  })}
                </div>

                {showHint && !checked && <div className="hint-box"><span aria-hidden="true">💡</span><p><strong>A little nudge</strong>{question.hint}</p></div>}

                {checked && (
                  <div className={`feedback-box ${isCorrect ? "success" : "try-again"}`} role="status">
                    <span className="feedback-icon" aria-hidden="true">{isCorrect ? "✓" : "↗"}</span>
                    <div>
                      <strong>{isCorrect ? "Brilliant thinking!" : "Good try — this is how we grow."}</strong>
                      <p>{isCorrect ? question.explanation : selectedChoice?.misconception?.feedback ?? question.hint}</p>
                      {!isCorrect && <small>We&apos;ll remember this skill and give you another friendly practice later.</small>}
                    </div>
                  </div>
                )}
              </article>

              <div className="action-row">
                <button className="hint-button" onClick={() => setShowHint((visible) => !visible)} disabled={checked}>
                  <span aria-hidden="true">💡</span>{showHint ? "Hide hint" : "Need a hint?"}
                </button>
                {checked ? (
                  <button className="primary-button" onClick={nextQuestion}>{questionIndex === questions.length - 1 ? "See my results" : "Next question"}<span>→</span></button>
                ) : (
                  <button className="primary-button" onClick={checkAnswer} disabled={!selectedId}>Check answer<span>→</span></button>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="encouragement-card">
          <button className="mascot" aria-label="Rabbit is listening" onClick={() => setEarsListening((listening) => !listening)}>
            <span className="mascot-ear left" /><span className="mascot-ear right" />
            <span className="mascot-face"><i className="eye left" /><i className="eye right" /><i className="nose" /></span>
            <span className="mascot-body" />
          </button>
          <div className="speech-bubble">
            <strong>{earsListening ? "I’m all ears!" : "You’ve got this!"}</strong>
            <p>{earsListening ? "That’s why I’m called Rabbit — I listen carefully and learn something new in every class." : "Take your time. Every try makes your math brain stronger."}</p>
          </div>
          <div className="focus-card"><span aria-hidden="true">◎</span><div><small>Today&apos;s focus</small><strong>Clear thinking</strong></div></div>
        </aside>
      </section>
      <ParentRewardSettings
        open={parentSettingsOpen}
        settings={rewardSettings}
        onClose={() => setParentSettingsOpen(false)}
        onSave={saveRewardSettings}
      />
      {earsListening && <div className="easter-toast" role="status"><span aria-hidden="true">🐰</span><p><strong>Rabbit is all ears!</strong>It listens carefully in every class.</p></div>}
    </main>
  );
}
