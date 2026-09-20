# Prompt for AI-assisted question authoring

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
- Do not invent fields outside the schema. If the objective cannot fit v1
  single-select, state nothing outside JSON; instead produce a narrower valid
  draft skill.

Before responding, re-check JSON syntax and every schema requirement. The output
will remain an AI draft until a human curriculum reviewer validates it.
```
