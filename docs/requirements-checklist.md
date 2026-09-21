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
- [x] Reading-rabbit logo concept integrated into the learner UI, with a matching coral, teal, and cream theme and rounded sans-serif typography. The generated raster logo is a prototype asset; a reviewed scalable brand master is still needed for production.
- [x] Explore packs prototype with distinct Math, Trivia, and English styles: eight fixed sample activities, server-side grading, image-backed single- and multi-select trivia, keyboard-accessible word reordering, and a rotatable prism. This pack is separate from the published v2 banks and does not yet feed parent reports or adaptation.
- [x] Rabbit “all ears” name easter egg on the logo and mascot.
- [x] API, schema, generator, safety, and question-bank property tests.
- [x] JSON schema documentation, required-format example, and reusable AI
  structured-output prompt.
- [x] Isolated Hostinger deployment workflow for frontend/backend container images.
  The workflow deploys to `~/rabbit` and writes `.env.prod` on the VPS for
  Compose image tags and host port.

## B. Partially implemented, prototype, or based on a major assumption

- [~] **Parent experience:** a clearly labelled demo view shows attempts, accuracy,
  misconception IDs, points, and reward settings. It has no secure parent account.
- [~] **Rewards:** parents can enable a target and name a present/experience, but
  data is kept only in backend memory and resets on restart.
- [~] **Progress and exact results:** recent server-side attempts are visible, but
  the report does not yet preserve/display the complete rendered question snapshot.
- [~] **Question templates:** v2 supports bounded-integer computed questions and
  scalar historical-event fact collections; authoring UI, automated publishing,
  richer parameter/fact types, and immutable database versions are absent.
- [~] **Vector rendering:** the fraction bar is real accessible SVG, but the general
  declarative geometry scene language is not implemented.
- [~] **Adaptivity:** misconception evidence is captured for later selection, but
  question sequencing currently presents all ten templates rather than adapting.
- [~] **Infrastructure:** local/production Compose and CI deployment definitions
  exist, but no actual Hostinger credentials, domain, TLS proxy, or live deployment
  can be verified from this repository.
- [~] **Persistence:** API boundaries and target entities are planned, but the
  prototype uses a process-local memory store rather than PostgreSQL/Redis/S3.
- [~] **Accessibility:** semantic controls, keyboard focus, MathML, SVG alt text,
  reduced motion, and responsive UI are present; a formal WCAG audit is not.

## C. Not yet implemented

- [ ] Free parent sign-up, OIDC login, Google/Apple federation, magic links, or
  passkeys.
- [ ] Parent-created child accounts, join code/PIN, QR handoff, session/device
  revocation, multiple guardians, and role-based authorization.
- [ ] PostgreSQL schema/migrations, family tenant isolation, row-level security,
  append-only attempts, transactional outbox, Redis jobs, or object storage.
- [ ] A real adaptive policy using mastery, recency decay, prerequisites, spaced
  repetition, exploration, or known-weakness distractor weighting.
- [ ] Parent charts, diagnostic summaries, complete exact-question/answer history,
  export, retention, deletion, and audit-log interfaces.
- [ ] Offline worksheet and answer-key PDF generation.
- [ ] General diagram scene specification and sanitized SVG compiler.
- [ ] Published English grammar, fill-in-the-blank, error spotting, multi-select,
  composition, rubric/manual grading, broader trivia/Canadian citizenship, or
  Ontario driving content beyond the fixed Explore packs examples. The included
  Canadian history collection is draft-only.
- [ ] Rewards ledger, anti-tampering rules, notifications, or fulfillment tracking.
- [ ] Full offline/PWA learner sessions and conflict-safe synchronization.
- [ ] Production legal/privacy review, parental consent flow, abuse/rate controls,
  monitoring/tracing, backups/restore tests, load tests, and disaster recovery.

## Decisions that still need product clarification

- Whether a child may belong to more than one family/guardian group.
- Minimum supported jurisdictions and ages at launch, which determine consent and
  retention rules.
- Whether reward points are lifetime, seasonal, per-child, or redeemable and then
  deducted. The prototype assumes cumulative points that are never removed.
- Initial curriculum/grade mapping and authoritative Canadian curriculum source.
- Whether offline means PDF only or also offline interactive practice.
