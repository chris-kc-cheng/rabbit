# Rabbit prototype

A responsive learner-facing prototype for Rabbit, a positive and adaptive
learning platform for students aged 10 and above.

## Included in this prototype

- A polished lesson player that works on desktop and mobile layouts.
- Ten deterministic elementary-math question generators covering arithmetic,
  fractions, place value, measurement, time, and word problems.
- Four choices per question, with every wrong choice tied to a misconception and
  actionable feedback rather than a random value.
- KaTeX formula rendering and an accessible SVG fraction model.
- Hints, answer feedback, streaks, gems, lesson progress, and a final summary.
- Generator tests for determinism, option uniqueness, and distractor rationale.

This is intentionally a client-only prototype. It does not yet persist learner
progress or include the parent, authentication, adaptive scheduling, API, or PDF
services described in `AGENTS.md`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm test
npm run lint
npm run build
```
