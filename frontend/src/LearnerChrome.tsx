import type { ReactNode } from "react";

/**
 * The public learner demo and authenticated learner workspace intentionally share
 * this chrome. Keeping the shell in one component prevents the marketing preview
 * from drifting away from the experience learners actually use after signing in.
 */
export function LearnerChrome({
  children,
  demo = false,
}: {
  children: ReactNode;
  demo?: boolean;
}) {
  return (
    <div className={`learner-layout${demo ? " learner-layout-demo" : ""}`}>
      {children}
    </div>
  );
}
