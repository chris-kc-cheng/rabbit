# Rabbit project guide

## Product direction

Rabbit is a mobile-friendly, game-like online learning platform for independent
learners aged 10 and above. It should pair short learning sessions with strong,
positive encouragement and meaningful rewards. The first curriculum is
elementary mathematics, but the platform and content model must remain
subject-neutral so that English grammar, trivia, Canadian citizenship, and
Ontario driving-test material can be added later without rebuilding the core.

There are two primary experiences:

- **Learner:** complete adaptive activities, receive immediate explanatory
  feedback, and earn progress and rewards.
- **Parent:** create and manage child profiles, inspect progress and attempts
  (including the exact rendered question, options, submitted answer, and
  rationale), and generate printable question-and-answer PDFs for offline use.

Do not expose a child's data publicly or use punitive language. Treat child
privacy, parental consent, accessibility, and auditability as first-class
requirements.

## Initial scope

Start with parameterized multiple-choice elementary-math questions. Every wrong
option is a deliberate **misconception distractor**, not a random value. For
example, a distractor may evaluate an expression left-to-right to diagnose that
the learner forgot multiplication/division precedence. Store the misconception
identifier on both the option and the learner's attempt so future parent reports
and the adaptive engine can distinguish an accidental miss from a repeated
reasoning pattern.

Do not implement English or trivia question types in the first slice, but avoid
assuming that every activity is multiple-choice, automatically gradable, or
mathematical. The future model must support fill-in-the-blank, error spotting,
multi-select, and long-form composition with manual or rubric-based evaluation.

## Architectural direction

Use a **modular monolith first**, with explicit module boundaries and a durable
event/outbox seam. This is easier to operate than microservices while the domain
is evolving, and modules can be extracted later if traffic or team ownership
requires it.

Recommended baseline:

- **Web:** TypeScript, Next.js, and React with a responsive, accessible design
  system. Prefer server rendering for parent/report pages and a PWA service
  worker for resilient learner sessions; do not claim full offline attempt sync
  until conflict and identity semantics are designed.
- **API/backend:** TypeScript with NestJS using REST/OpenAPI at the external
  boundary. Keep domain logic (generation, grading, adaptation) in plain,
  framework-independent packages. Background workers handle PDF rendering,
  mastery updates, and notifications.
- **Data:** PostgreSQL as the system of record, Redis for queues, rate limits,
  and short-lived cache/locks, and S3-compatible object storage for generated
  PDFs and immutable media. Use a transactional outbox for reliable background
  work. Do not make Redis authoritative.
- **Operations:** containerized services; begin with a managed PostgreSQL,
  managed Redis/queue, object storage, and one web/API plus one worker
  deployment. Add CDN/WAF, structured logs, traces, metrics, encrypted backups,
  secret management, and separate development/staging/production environments.
- **Content authoring:** version content in Git for review, validate it in CI,
  then publish immutable template versions into PostgreSQL. Attempts always
  reference the exact published version and preserve a render snapshot.

## Question template contract

Author templates as YAML for readability, validate them against a versioned JSON
Schema, and store the canonical normalized document as PostgreSQL `jsonb`.
Never evaluate author-provided JavaScript or arbitrary LaTeX commands. Use a
small, deterministic expression DSL with checked operators and whitelisted
render primitives.

A representative normalized template is:

```yaml
schemaVersion: 1
id: math.order-of-operations.two-ops
version: 3
subject: math
skills: [arithmetic.order-of-operations]
type: single_select
difficulty: { band: 3 }
locale: en-CA
parameters:
  a: { type: int, min: 2, max: 12 }
  b: { type: int, min: 2, max: 12 }
  c: { type: int, min: 1, max: 20 }
constraints:
  - distinct(correct, left_to_right)
stem:
  blocks:
    - { type: text, value: "Evaluate:" }
    - { type: math, latex: "{{a}} + {{b}} \\times {{c}}" }
answer:
  evaluator: expression
  expression: "a + b * c"
distractors:
  - id: left-to-right
    misconception: math.precedence.left-to-right
    expression: "(a + b) * c"
    feedback: "Multiplication is evaluated before addition."
  - id: add-factors
    misconception: math.operation.multiplied-as-addition
    expression: "a + b + c"
    feedback: "The multiplication sign combines factors, not addends."
selection:
  optionCount: 4
  strategy: weighted_without_replacement
render:
  diagram: null
```

The schema should require stable template, skill, distractor, and misconception
IDs; typed parameter domains; constraints; structured content blocks; answer
and grading specifications; explanation/feedback; difficulty; locale; and
accessibility metadata. Seeded generation must produce the same instance from
`template_version + generator_version + seed`. Reject instances with duplicate
options, invalid domains, ambiguous answers, non-finite values, or impossible
constraints. Persist the chosen parameters, shuffled option order, computed
answers, rationales, seed, generator version, and final render payload.

## Math and diagram rendering

- Render formula blocks with KaTeX from a restricted LaTeX allowlist. Validate
  and render server-side for previews and PDFs, while retaining accessible source
  text (MathML/ARIA) in the web client.
- Describe diagrams using a versioned, declarative scene specification (for
  example: canvas/viewBox, points, lines, polygons, arcs, axes, labels, styles,
  and semantic descriptions). Resolve all variables on the server and compile
  the scene to sanitized SVG; never store or execute raw authored SVG/scripts.
- Use the same resolved render payload for web and print. A headless Chromium
  worker can produce PDFs so KaTeX, SVG, pagination, answer keys, and fonts match
  the learner view. Store the generated artifact with template/version/seed and
  expiry/ownership metadata.

## Persistence model

Keep frequently queried identity and learning facts relational; use `jsonb` only
for versioned content/render payloads and bounded metadata. Expected tables or
equivalent aggregates include:

- `users`, `auth_identities`, `families`, `family_memberships`, `learner_profiles`
- `subjects`, `skills` (a prerequisite graph), `content_templates`,
  `content_template_versions`, `misconceptions`
- `question_instances`, `question_options`, `learning_sessions`, `attempts`,
  `attempt_responses`
- `learner_skill_state`, `learner_misconception_state`, `reward_ledger`
- `print_jobs`, `artifacts`, `audit_events`, `outbox_events`

An attempt is append-only and records timestamps, response, correctness,
latency, hint usage, selected misconception (if any), and the exact question
snapshot. Derived mastery/misconception state can be recomputed from attempts.
Use tenant/family ownership checks in every query and service boundary; prefer
database row-level security as defense in depth. Define retention, export, and
deletion workflows before collecting child data.

## Identity and access

Offer free parent registration through an OpenID Connect provider/broker with
email magic link/passkey plus optional Google and Apple federation. OAuth 2.0 is
an authorization protocol; use **OIDC** for login. Keep the external provider
subject in `auth_identities`, not as the domain user ID.

Children should normally be parent-created learner profiles, not independent
social accounts. Support low-friction child access with a family/join code plus
PIN, a parent-approved device-bound passkey, or a short-lived QR handoff. Do not
require children to own email addresses or directly use social OAuth. Model roles
and relationships explicitly (`parent`, `learner`, later `educator/admin`), allow
multiple guardians where appropriate, use short sessions on shared devices, and
provide parent-visible device/session revocation. Age/region-aware consent and
privacy requirements need legal review before launch.

## Adaptation and reporting

Begin with an explainable policy rather than opaque ML:

1. Track per-skill mastery and per-misconception evidence with recency decay.
2. Select the next skill from prerequisites, mastery gaps, spaced-review needs,
   and a controlled exploration rate.
3. Select templates that cover that skill, then weight distractors toward known
   misconceptions while retaining some diagnostic alternatives.
4. Enforce diversity, difficulty, and repetition limits; log the policy version
   and reasons for every selection.
5. Update state only from immutable attempts and periodically calibrate question
   difficulty and distractor usefulness from aggregate data.

Reports must label rationale as evidence ("selected an option consistent with
left-to-right evaluation 3 times"), not a diagnosis. Preserve enough lineage to
replay why a question was selected and how it was graded.

## Delivery sequence

1. Record architecture decisions and define the content JSON Schema, diagram
   schema, IDs/versioning policy, and threat/privacy model.
2. Build a deterministic generator/grader library with property tests and a
   content validation CLI; author a small reviewed math template set.
3. Add parent identity, families/learner profiles, authorization, and audit logs.
4. Deliver the responsive learner loop and immutable attempt capture.
5. Add basic mastery/misconception tracking, explainable adaptive selection, and
   parent attempt/progress views.
6. Add queued, reproducible PDF worksheets and answer keys.
7. Harden accessibility, observability, abuse controls, privacy operations,
   backups/restore, and load testing before broader release.

## Engineering rules

- Keep generation, grading, adaptation, and rendering deterministic and versioned.
- Validate at trust boundaries and test tenant isolation and authorization.
- Use migrations for schema changes and idempotency keys for submissions/jobs.
- Add property/fuzz tests for generators and golden tests for HTML/SVG/PDF output.
- Avoid hardcoded curriculum logic in UI or controllers; register question-type
  renderers and graders through stable interfaces.
- Do not introduce microservices, arbitrary code execution in templates, raw SVG,
  or an unreviewed AI grader without an explicit architecture decision record.
