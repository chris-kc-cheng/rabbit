# Rabbit project guide

## Product requirements

Rabbit is a positive, game-like online learning platform for independent learners
aged 10 and above. It must be clean and usable on mobile devices, strongly
encourage effort, and never use punitive language. Elementary mathematics is the
first subject, but the domain must remain extensible to English grammar, trivia,
Canadian citizenship-test preparation, and Ontario driving-test preparation.

Two experiences are required:

- **Learner:** complete adaptive activities, get immediate explanatory feedback,
  earn points, and optionally work toward a parent-chosen present or experience.
- **Parent:** register for free, manage children, configure optional rewards, see
  progress and misconception evidence, review exact questions and submitted
  answers, and generate question-and-answer PDFs for offline work.

The engine starts with parameterized single-select questions. Wrong choices are
not random: each represents a stable misconception and carries supportive
feedback. Generation must be reproducible from a versioned template, generator
version, and seed. Adaptation must use skill mastery and misconception evidence
both to choose future questions and to choose diagnostic distractors.

Future types include fill-in-the-blank, error spotting, multi-select, and
composition with rubric/manual evaluation. Do not encode assumptions that all
questions are mathematical, automatically gradable, or multiple-choice.

Child privacy, parental consent, accessibility, authorization, data minimization,
auditability, deletion/export, and age/region-aware legal review are release
requirements—not later polish.

## Chosen architecture

- **Frontend:** React with TypeScript and Vite. It consumes JSON APIs and does not
  own grading rules or correct answers.
- **Backend:** FastAPI with Pydantic. Keep generation, grading, adaptation, and
  persistence behind explicit Python modules so the web framework is replaceable.
- **Data exchange and content:** JSON. The normative v1 content contract is
  `content/question-template.schema.json`; the initial bank is
  `content/math.question-bank.json`.
- **Persistence target:** PostgreSQL for relational identity/attempt facts and
  `jsonb` for immutable content/render snapshots. Redis may later support queues,
  locks, and rate limits but must not be authoritative. The current memory store
  is prototype-only.
- **Artifacts:** S3-compatible storage for immutable media and PDFs.
- **Operations:** Docker Compose orchestrates the React/nginx frontend and FastAPI
  backend. Production images are published independently and deployed as the
  isolated `rabbit-learning` Compose project.

Start as a modular monolith. Do not introduce microservices until scaling or team
ownership justifies the operational cost. Use a transactional outbox when durable
background jobs and PostgreSQL are added.

## Question authoring contract

The schema supports the currently implemented `single-select` type with:

- stable template, skill, distractor, and misconception IDs;
- immutable positive versions, locale, and difficulty;
- bounded integer parameters;
- structured text and restricted-LaTeX prompt blocks;
- a small arithmetic expression DSL (never Python, JavaScript, or `eval`);
- one answer expression and at least three misconception-based distractors;
- hints, worked explanations, accessibility text, and an optional fraction bar.

The API must never send correct-answer or misconception metadata before an
attempt. It returns grading feedback after a single idempotent logical submission.
Reject duplicate choices, invalid parameter domains, unsafe expressions,
ambiguous answers, non-finite values, and impossible templates. Published content
must be human-reviewed and immutable.

Keep these synchronized whenever capabilities change:

1. `content/question-template.schema.json`
2. `content/math.question-bank.json`
3. `docs/question-bank.md`
4. `docs/ai-question-authoring-prompt.md`
5. `docs/requirements-checklist.md`

## Rendering

Render formula blocks with KaTeX using strict parsing, HTML+MathML output, and
untrusted commands disabled. Render diagrams from versioned declarative scene
specifications compiled to sanitized SVG; never accept authored scripts or raw
SVG. Web and future print/PDF output must share the resolved render payload.

## Identity and access direction

Use OpenID Connect (OIDC) for parent login, with email magic link/passkey and
optional Google/Apple federation. OAuth alone is not an identity protocol.
Children should normally be parent-created profiles and use a join code plus PIN,
parent-approved passkey, or short-lived QR handoff rather than requiring email or
social login. Model parent/learner roles and family relationships explicitly and
test tenant isolation at every boundary.

## Adaptation and reporting direction

Begin with an explainable policy: track per-skill mastery and per-misconception
evidence with recency decay; choose prerequisite-ready gaps and spaced review;
weight distractors toward known weaknesses while retaining exploration; enforce
repetition/diversity limits; and log the policy version and selection reasons.
Reports describe evidence (for example, “selected the left-to-right route three
times”), never diagnose a child.

## Engineering rules

- Before every commit and push, review the files and diffs being sent for
  secrets, private keys, credentials, tokens, and production `.env` values.
  Remove any such data from Git history or the pending changes before proceeding.
- Update documentation and the requirements checklist in the same change as a
  capability, limitation, content contract, or operational change.
- Validate JSON content against its schema and property-test generated choices.
- Keep grading server-side; never leak answers in session payloads.
- Use migrations, append-only attempts, exact question snapshots, idempotency
  keys, and recomputable derived state when PostgreSQL is introduced.
- Test authorization and family isolation before introducing real accounts.
- Add golden tests for HTML/SVG/PDF rendering and accessibility checks.
- Never use arbitrary code execution, unsafe YAML, raw authored SVG, or an
  unreviewed AI grader/content item.
