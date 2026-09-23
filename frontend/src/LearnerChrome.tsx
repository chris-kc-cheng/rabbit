import type { ReactNode } from "react";

/**
 * The public learner demo and authenticated learner workspace intentionally share
 * this chrome. Keeping the shell in one component prevents the marketing preview
 * from drifting away from the experience learners actually use after signing in.
 */
export function LearnerChrome({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  return <div className={`learner-layout${demo ? " learner-layout-demo" : ""}`}>
    <aside className="trail"><p className="eyebrow">Your path</p><h2>Math Explorer</h2><ol><li className="done">✓ <span>Ready<small>{demo ? "Demo started" : "Signed in"}</small></span></li><li className="active">✦ <span>Mixed practice<small>In progress</small></span></li></ol></aside>
    {children}
    <aside className="coach"><img className="mascot" src="/rabbit-encouraging.png" alt="A friendly guide giving an encouraging thumbs-up" /><div><strong>You&apos;ve got this!</strong><p>Every thoughtful try makes your learning stronger.</p></div></aside>
  </div>;
}
