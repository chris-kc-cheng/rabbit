# Prompt for AI-assisted question authoring

This prompt targets only computed single-select templates in the normative v2 bank.
The fixed multi-type examples in `content/demo-pack.json` are prototypes under
`content/demo-pack.schema.json` and still need human review; do not use this prompt to
publish questions of those types.

## Broad subjects with multiple topics

A question bank is a subject-level document, not a one-topic file. For a broad
subject such as Grade 5 mathematics, prefer one complete bank whose `templates`
array contains templates for all reviewed subtopics. Give every subtopic a stable,
namespaced `skill` such as `math.grade-5.fractions.equivalent-fractions`. Multiple
templates may share a skill when they provide different question forms or levels
of difficulty.

Before drafting JSON, turn the supplied curriculum into a reviewable coverage
plan: list the subtopics, their stable skill IDs, the intended difficulty range,
and the number of templates needed for each. Do not invent curriculum outcomes.
Ask the author for the governing curriculum or source material when it is not
provided. Generate and validate templates in small batches, then combine them in
one bank envelope only after every template passes schema validation, seeded
generation tests, accessibility review, and human curriculum review.

Split a broad subject into multiple bank files only when there is a real publishing
boundary—for example a different grade, locale, curriculum authority, review
owner, or release schedule. File boundaries are not topic selectors: Rabbit uses
each template's `skill` value to let a parent choose one, several, or all topics.

For a multi-topic bank, use this planning request before the template prompt:

```text
Using only the attached curriculum, propose a coverage plan for <BROAD_SUBJECT>.
Return a table with subtopic, stable namespaced skill ID, curriculum reference,
difficulty range, and proposed template count. Do not write question JSON yet.
Do not add outcomes that are absent from the supplied curriculum. Flag overlaps,
prerequisites, and any outcome that the current Rabbit schema cannot represent.
```

Attach `content/question-template.schema.json`, then replace the angle-bracketed
values and send the following prompt to a model:

```text
You are drafting curriculum content for Rabbit, a positive learning platform for
students aged 10 and above. Create one elementary-math single-select template for
<SKILL> at difficulty <1-5>, using Canadian English.

Return one strict JSON object matching one item in the `templates` array of the
attached Rabbit schema. Output JSON only: no Markdown, comments, trailing commas,
or extra prose.

Requirements:
- Use a stable namespaced id, version 1, and declared bounded integer parameters.
- Use only the Rabbit arithmetic DSL: declared variables, numeric constants,
  parentheses, +, -, *, /, //, and %. Never output Python, JavaScript, HTML, raw
  SVG, a URL, or an untrusted LaTeX command.
- Provide structured text/math prompt blocks, exactly one answer expression, a
  useful hint, a worked explanation, and meaningful screen-reader text.
- When the question needs structured data or a diagram, use exactly one supported
  declarative `visual`: `data-table`, `fraction-bar`, `rectangle-grid`, `angle`,
  `triangle`, `solid`, or `scene-2d`. Use expressions only in fields marked as
  expressions by the schema, keep scene points inside the 0–100 view box, and
  provide an `alt` description that includes every fact needed to answer without
  seeing the graphic. Prefer a specific visual type over `scene-2d`.
- For `data-table`, keep every row the same length as `columns`, use the caption
  to identify the data, and interpolate only declared parameters. For `scene-2d`,
  declare unique point IDs before referencing them from segments or polygons.
- Provide at least three plausible and mathematically distinct wrong-answer
  expressions. Each needs a stable id, stable misconception id, and supportive
  feedback explaining the next step without labeling or shaming the learner.
- Silently test minimum, middle, and maximum parameter values. Correct and wrong
  values must be finite and distinct. Avoid ambiguous wording, division by zero,
  unintended negative answers, stereotypes, personal data, advertising, and
  promises of rewards.
- Do not invent fields outside the schema. If the objective cannot fit a v2 computed
  single-select, state nothing outside JSON; instead produce a narrower valid
  draft skill.

Before responding, re-check JSON syntax and every schema requirement. The output
will remain an AI draft until a human curriculum reviewer validates it.
```

## Historical-event collection prompt

Attach the schema and authoritative source material. Ask the model for one
`fact-collection-single-select` template containing at least four closely related
events, stable IDs, scalar `year` and `event` fields, and at least one variant.
The variant must use a declared `answerField` and `distractorPoolField`, supportive
feedback, a stable misconception ID, and `{{fact.<field>}}` interpolation only.
Require exact source title, URL, and section locator. Set `source.reviewStatus` to
`draft`; only a human curriculum reviewer may change it to `reviewed` and publish
the containing bank. Never ask the model to invent missing facts or citations.

## Complete Discover Canada prompt

The in-app Docs page automatically appends the complete live JSON Schema to this
prompt, so no attachment is required. Paste the exact relevant Discover Canada
excerpts into the marked block and replace the angle-bracketed inputs. This asks
for a complete bank document, so the response can be pasted directly into
Rabbit's public validator.

```text
You are a careful curriculum-content researcher drafting a Canadian citizenship
question bank for Rabbit, for independent learners aged 10 and above.

INPUTS
1. The Rabbit JSON Schema pasted at the end of this prompt (the sole structural contract).
2. Discover Canada excerpts pasted after <DISCOVER_CANADA_EXCERPTS>.

TASK
Create one COMPLETE question-bank v2 JSON document, not a lone template. Set
schemaVersion to 2, generatorVersion to "2.0.0", publicationStatus to "draft",
subject to "canadian-citizenship", locale to "en-CA", and include one
fact-collection-single-select template. Focus on <TOPIC_OR_CHAPTER>.

SOURCE RULES
- Use only facts stated explicitly in my supplied Discover Canada excerpts. Do
  not rely on memory, browse, infer missing dates, or invent citations.
- Store at least four closely related events. Give every fact a stable lowercase
  ID, integer year, and concise event string.
- Set source.title to "Discover Canada: The Rights and Responsibilities of
  Citizenship", source.url to <OFFICIAL_URL>, source.locator to
  <CHAPTER_OR_PAGE_HEADING>, and source.reviewStatus to "draft".

QUESTION RULES
- Add an identify-year variant using answerField and distractorPoolField "year"
  and {{fact.event}} interpolation.
- Use a stable misconception ID and supportive feedback that explains timeline
  reasoning without shaming or diagnosing the learner.
- Difficulty is an integer from 1 (introductory recall) to 5 (challenging
  discrimination).
- Include a useful hint, an explanation that states {{fact.event}} and
  {{fact.year}}, and meaningful screen-reader text.
- Facts must yield at least four DISTINCT year values so one correct choice and
  three distractors can always be generated.

OUTPUT RULES
Return strict JSON only: no Markdown fences, comments, trailing commas,
citations outside the source object, or extra prose. Do not invent fields outside
the pasted schema. Before responding, verify every required field, stable-ID
pattern, length constraint, distinct year, and interpolation path. This remains
an unreviewed draft; only a human may mark it reviewed or published.

<DISCOVER_CANADA_EXCERPTS>
Paste the exact official excerpts here.
</DISCOVER_CANADA_EXCERPTS>

<RABBIT_QUESTION_BANK_V2_SCHEMA>
Paste the complete content/question-template.schema.json here. The in-app Copy
button inserts the live schema automatically.
</RABBIT_QUESTION_BANK_V2_SCHEMA>
```
