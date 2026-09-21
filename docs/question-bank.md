# Rabbit JSON question bank

## Normative files

- `content/question-template.schema.json` is the JSON Schema Draft 2020-12
  contract for a complete bank.
- `content/math.question-bank.json` is the published ten-template elementary
  math bank loaded by FastAPI.
- `content/canadian-citizenship.question-bank.json` is a draft, executable
  example of a reusable historical-event collection based on *Discover Canada*.
  Draft banks appear in the prototype learner subject catalogue when an admin
  enables **Draft questions**. They are labelled Draft in the UI and can be
  hidden immediately; published banks remain available.

The frontend **Docs** page gives authors an approachable overview of the bank
envelope, an example for every current published or prototype question type,
and a copyable AI-drafting prompt. The files above remain the authoritative
contracts whenever the page and source schema differ.

The page also has a public validator for a complete question-bank v2 JSON
document. It reports JSON paths and suggested fixes for schema failures and runs
a seeded generation smoke test without importing or retaining the submitted
document. Signed-in users can always return to Docs from the main navigation.

Schema v2 supports computed `single-select` templates and reusable
`fact-collection-single-select` templates. Each computed template has bounded parameters,
structured prompt blocks, a server-side answer expression, and at least three
wrong-answer routes. Each wrong route has a stable misconception ID and feedback.
The expression language permits numeric constants, declared variables,
parentheses, and `+`, `-`, `*`, `/`, `//`, and `%`. It never executes Python or
JavaScript.

## Fixed subject-pack prototype

`content/demo-pack.json` contains eleven fixed prototype examples for the
Explore packs screen. Its separate contract is `content/demo-pack.schema.json`.
The pack covers a labeled trigonometry triangle, a rotatable rectangular prism,
a KaTeX formula question, image-backed quiz and multi-select trivia, fill-in-the-blank,
word reordering, grammar correction, and three Canadian history questions based
on the draft *Discover Canada* fact collection. The bitmap is stored at
`frontend/public/trivia-animals.png`. The API removes `answer` and `feedback`
before an attempt and grades each kind on the server. These examples are not
parameterized, adaptive, or part of the published v2 banks. The published math
bank remains the source of truth for regular learner sessions. The examples still
need curriculum review before any production publication.

## Required template example

```json
{
  "id": "math.order-of-operations.multiply-before-add",
  "version": 1,
  "type": "single-select",
  "skill": "math.order-of-operations",
  "difficulty": 3,
  "parameters": {
    "a": { "type": "integer", "min": 3, "max": 9 },
    "b": { "type": "integer", "min": 2, "max": 7 },
    "c": { "type": "integer", "min": 3, "max": 8 }
  },
  "prompt": [
    { "type": "text", "value": "Solve the expression." },
    { "type": "math", "value": "{{a}} + {{b}} \\times {{c}}" }
  ],
  "answer": { "expression": "a + b * c", "format": "number" },
  "distractors": [
    {
      "id": "left-to-right",
      "misconception": "math.precedence.left-to-right",
      "expression": "(a + b) * c",
      "feedback": "Multiplication comes before addition. Multiply {{b}} by {{c}} first."
    },
    {
      "id": "multiply-as-addition",
      "misconception": "math.operation.multiply-as-addition",
      "expression": "a + b + c",
      "feedback": "The multiplication sign combines equal groups; it does not mean add."
    },
    {
      "id": "wrong-pair",
      "misconception": "math.precedence.wrong-pair",
      "expression": "a * b + c",
      "feedback": "Check which values the multiplication sign joins: {{b}} and {{c}}."
    }
  ],
  "hint": "Multiplication and division happen before addition and subtraction.",
  "explanation": "First, {{b}} × {{c}} = {{b * c}}. Then {{a}} + {{b * c}} = {{a + b * c}}.",
  "accessibility": {
    "screenReaderText": "Solve a plus b times c, applying multiplication before addition."
  }
}
```

A bank wraps templates with `schemaVersion`, `generatorVersion`,
`publicationStatus`, `subject`, `title`, and `locale`. Validate the
whole file, then property-test many seeds because JSON Schema cannot prove that
computed options remain distinct.

## Reusable fact collections

A fact collection stores related knowledge once and defines one or more question
variants over it. The Canadian history example contains a `knowledge.facts` list
of historical events. Its `identify-year` variant selects one fact from the list,
renders `{{fact.event}}`, uses `fact.year` as the server-side answer, and draws
three distinct years from the other facts as diagnostic options. One object can
therefore produce many questions without copying the source facts.

Every fact and variant has a stable ID. Generated questions retain the template
version, variant ID, and selected fact ID internally. The public session payload
contains the variant ID but never the selected fact ID, correct choice, or
misconception metadata.

Double braces are Rabbit's own deliberately small interpolation convention, not
an embedded Mustache, Handlebars, or Jinja runtime. Computed math templates accept
only the arithmetic DSL inside braces. Fact templates accept only a declared
dotted value path such as `{{fact.event}}`; calls, indexing, filters, and arbitrary
code are rejected.

Fact collections currently require at least four facts and support text or
integer scalar fields. A variant identifies one answer field and one distractor
pool field. All distractors currently share one timeline-confusion route;
future content versions may add per-fact misconception mappings and other fact
types. Selection and option shuffling use the session's seeded random generator.

## Publishing rules

AI output is always a draft. A curriculum reviewer must verify math, age fit,
parameter extremes, all misconception mappings, accessibility, and supportive
language before publication. Version published templates rather than editing them
in place. The current prototype reads Git-managed JSON at startup; database
publishing and immutable snapshots remain to be implemented.

The Canadian history bank remains `draft` because its source facts still require
human curriculum review. Prototype admins may expose it for review without
changing its publication status; production use still requires formal review and
a new immutable published version.
