# Prompt for AI-assisted question authoring

This prompt targets only computed single-select templates in the normative v2 bank.
The fixed multi-type examples in `content/demo-pack.json` are prototypes under
`content/demo-pack.schema.json` and still need human review; do not use this prompt to
publish questions of those types.

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

Attach `content/question-template.schema.json` and the exact relevant excerpts
from the Government of Canada publication before using this prompt. Replace the
angle-bracketed inputs. This asks for a complete bank document, so the JSON can
be pasted directly into Rabbit's public validator.

```text
You are a careful curriculum-content researcher drafting a Canadian citizenship
question bank for Rabbit, for independent learners aged 10 and above.

INPUTS
1. The attached rabbit-question-bank-v2.schema.json (the sole structural contract).
2. Excerpts supplied by me from the Government of Canada publication Discover Canada.

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
the attached schema. Before responding, verify every required field, stable-ID
pattern, length constraint, distinct year, and interpolation path. This remains
an unreviewed draft; only a human may mark it reviewed or published.
```
