# Rabbit requirements and implementation status

This checklist reconciles the requirements supplied so far. “Implemented” means
working in this repository, not production-ready at population scale.

## A. Implemented with confidence

- [x] React and TypeScript frontend with responsive desktop/mobile layouts.
- [x] FastAPI backend with JSON request/response models and generated OpenAPI docs.
- [x] Docker Compose orchestration under project `rabbit` for separate frontend
  and backend containers; web binds to host loopback port 8090 by default, and
  API port 8000 remains internal.
- [x] JSON Schema v2 and Git-managed question banks with ten published
  elementary-math templates plus a draft Discover Canada historical-event example.
- [x] Reusable fact collections with stable fact/variant IDs, restricted dotted
  interpolation, seeded selection, and other-fact distractor pools.
- [x] Seeded parameter generation, server-side grading, answer shuffling, hints,
  explanations, and duplicate-choice rejection.
- [x] Wrong answers mapped to stable misconception IDs and supportive feedback.
- [x] Correct answers and misconception metadata withheld until submission.
- [x] Strict KaTeX formula rendering and an accessible vector fraction-bar visual.
- [x] Learner practice loop with progress, positive feedback, and points.
- [x] Password hashing uses an explicit scrypt memory allowance and round-trip tests
  for administrator, parent, and learner credential shapes.
- [x] Reader-comfort typography and a responsive, persistent light/dark theme
  control that defaults to the learner's operating-system preference.
- [x] Reading-rabbit logo concept integrated into the learner UI, with a matching coral, teal, and cream theme and rounded sans-serif typography. The generated raster logo is a prototype asset; a reviewed scalable brand master is still needed for production.
- [x] Explore packs prototype with distinct Math, Trivia, English, and Discover Canada styles: eleven fixed sample activities, including three Canadian history questions, server-side grading, image-backed single- and multi-select trivia, keyboard-accessible word reordering, and a rotatable prism. The demo also includes a clearly labeled, illustrative parent dashboard with learner tracking, reward progress, misconception evidence, and a PDF activity pack containing all kid-view questions, diagrams, formulas, and images. Demo activity remains non-persistent and does not feed real parent reports or adaptation.
- [x] Rabbit “all ears” name easter egg on the logo and mascot.
- [x] API, schema, generator, safety, and question-bank property tests.
- [x] In-app and written JSON schema documentation, per-type examples, an AI-ready schema download, responsive field-by-field tree tables, parameter and formula boundaries, a live fraction-bar playground, and a self-contained Discover Canada AI
  structured-output prompt, with a public schema and generation validator that
  remains available from signed-in workspaces.
- [x] Isolated Hostinger deployment workflow for frontend/backend container images.
  The workflow deploys to `~/rabbit`, preserves server-managed `.env.prod` settings,
  and writes image tags separately to `.env.deploy` for Compose.
- [x] Public product landing page with an illustrative product preview and a
  prominent, non-persistent reviewed-demo entry point.
- [x] Prototype password login/logout with expiring signed JWT access tokens,
  automatic return to login after a 401, and admin/parent/learner role guards.
- [x] Production Compose refuses to start the prototype identity service without
  configured admin-password and JWT-signing secrets; local Compose also requires
  an explicitly configured admin password.
- [x] Authenticated, responsive administrator workspace with overview,
  curriculum, people, and settings navigation. Administrators can create,
  edit, pause, and reset access for managed accounts; preview built-in and
  imported banks down to their template metadata; import or replace drafts;
  delete drafts; permanently publish reviewed banks; and control draft-bank
  visibility. JSON imports retain path-specific schema errors and a generation
  smoke test. Built-in drafts can be tested through removable database overrides
  (removing one restores the bundled baseline), while published banks remain
  immutable. The curriculum inspector distinguishes authored templates from
  their fact/variant/parameter generation space, exposes exact stored JSON, and
  produces seeded server-side question previews.
- [x] Authenticated parent dashboard for creating learners, resetting their
  passwords, reviewing progress/answer and misconception evidence, and setting
  individual accuracy reward goals, with family-boundary authorization tests.
- [x] Parent-only, topic-filtered PDF worksheet generation for 1–50 reproducible
  questions, with a separate answer key and worked explanations.
- [x] PostgreSQL 17 service definitions, SQLAlchemy 2 persistence boundaries, and
  Alembic migrations for families, guardians, users, and learner profiles.
- [x] PostgreSQL persistence for generated practice sessions, private grading
  snapshots, append-only attempts, exact public question snapshots, reward
  settings, imported banks, draft visibility, logout revocations, and anonymous
  demo sessions/attempts. Database uniqueness makes one logical answer durable
  even when multiple API workers receive it concurrently.

## B. Partially implemented, prototype, or based on a major assumption

- [~] **Identity and parent experience:** working prototype accounts are role- and
  family-protected and persisted in PostgreSQL, but password login is temporary;
  OIDC-backed identity, audited storage access, and child login handoff are absent.
- [~] **Rewards:** parents can durably enable a target and name a
  present/experience, but there is not yet a lifetime transaction ledger,
  deduction policy, approval, or fulfillment workflow.
- [~] **Progress and exact results:** each attempt preserves the resolved question
  snapshot, chosen and correct answers, timing, and hint evidence. Learners and
  their parent can review the complete PostgreSQL-backed history. Mastery and
  report aggregates are still computed on read rather than maintained as durable,
  recomputable projections.
- [~] **Question templates:** v2 supports bounded-integer computed questions and
  scalar historical-event fact collections. The admin workspace supports bank
  preview and a draft review/publish lifecycle, but field-level template
  authoring, richer parameter/fact types, and separately addressable immutable
  database versions are absent.
- [~] **Vector rendering:** the fraction bar is real accessible SVG, but the general
  declarative geometry scene language is not implemented.
- [~] **Adaptivity:** misconception evidence is captured for later selection, but
  question sequencing currently presents all ten templates rather than adapting.
- [~] **Infrastructure:** local/production Compose and CI deployment definitions
  exist, but no actual Hostinger credentials, domain, TLS proxy, or live deployment
  can be verified from this repository.
- [~] **Persistence:** all current mutable backend state is stored through
  SQLAlchemy and Alembic; JSONB holds immutable content/render/grading snapshots
  on PostgreSQL. Redis is still absent because there are no durable background
  jobs yet, S3-compatible storage is absent because PDFs are streamed rather than
  retained, and production backup/restore automation remains operational work.
- [~] **Accessibility:** semantic controls, keyboard focus, MathML, SVG alt text,
  reduced motion, and responsive UI are present; a formal WCAG audit is not.

## C. Not yet implemented

- [ ] Free parent sign-up, OIDC login, Google/Apple federation, magic links, or
  passkeys. Prototype username/password login is not the chosen production identity solution.
- [ ] Join code/PIN, QR handoff, immediate session/device revocation, multiple
  guardians within one family, durable audit logs, and forced temporary-password
  change. Basic parent-created learner accounts and role/family authorization are
  implemented in PostgreSQL; a learner must not belong to multiple families.
- [ ] PostgreSQL row-level security, database triggers/privilege separation that
  make attempts physically append-only, a transactional outbox, Redis-backed
  jobs/rate limits, and S3-compatible artifact storage. Application code currently
  only inserts attempts, but database credentials still permit mutation.
- [ ] A real adaptive policy using mastery, recency decay, prerequisites, spaced
  repetition, exploration, or known-weakness distractor weighting.
- [ ] Parent charts, diagnostic summaries, history export, retention, deletion,
  and audit-log interfaces.
- [ ] General diagram scene specification and sanitized SVG compiler.
- [ ] Published English grammar, fill-in-the-blank, error spotting, multi-select,
  composition, rubric/manual grading, broader trivia/Canadian citizenship, or
  Ontario driving content beyond the fixed Explore packs examples. The included
  Canadian history collection is draft-only.
- [ ] Per-child lifetime rewards ledger, enabled-by-default point deductions,
  anti-tampering rules, notifications, or fulfillment tracking. Scoring and reward
  design should prioritize accuracy over answer quantity.
- [ ] Production Canadian legal/privacy review for learners aged 10 and above,
  parental consent flow, abuse/rate controls, monitoring/tracing, backups/restore
  tests, load tests, and disaster recovery.

## Confirmed product decisions

- Each child belongs to exactly one family/guardian group. A family may still have
  multiple guardians.
- The launch jurisdiction is Canada and the minimum learner age is 10. Consent,
  retention, and legal review must be designed for that launch scope rather than
  treated as globally uniform.
- Reward points are a lifetime, per-child balance. Point deductions are supported
  when enabled and are enabled by default, so rewards can emphasize accuracy over
  answer quantity. The current prototype's non-deducting counter is not the final
  ledger behavior.
- Initial curriculum alignment uses the [York Region District School Board
  curriculum documents](https://www2.yrdsb.ca/about-us/departments/curriculum-instructional-services/curriculum-documents)
  as the authoritative Canadian curriculum entry point. Specific grade mappings
  must be recorded as content is aligned and reviewed.
- Offline support means printable question-and-answer PDFs only. Offline
  interactive practice, answer checking, PWA sessions, and synchronization are
  out of scope.
