# Rabbit JSON question bank

## Normative files

- `content/question-template.schema.json` is the JSON Schema Draft 2020-12
  contract for a complete bank. “2020-12” is the official JSON Schema
  specification release name, not a Rabbit content date or a generated value.
- `content/math.question-bank.json` is the published ten-template elementary
  math bank loaded by FastAPI.
- `content/math-visuals.question-bank.json` is a draft review bank exercising
  every declarative table and visual type. It is deliberately not published;
  curriculum and accessibility reviewers must approve its content first.
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

### Numeric precision and answer formats

Rabbit evaluates the answer and every distractor first, then applies the selected
`answer.format`, and finally checks that the four learner-visible strings are
distinct. Authors must therefore choose the format for the precision learners
need to see—not merely for the numeric type used by the expression:

| Format | Learner-visible rule | Use it for |
| --- | --- | --- |
| `number` | General, unpadded numeric text; integer-valued results omit `.0` and trailing zeros are not preserved. | Whole numbers and non-currency values whose choices must remain distinct beyond one decimal place. |
| `decimal` | Exactly one digit after the decimal point, rounded to the nearest tenth. | Measurements or calculations intentionally answered to tenths. |
| `money` | A `$` prefix and exactly two digits after the decimal point, rounded to the nearest cent. | Canadian-dollar amounts. |

Formatting is part of grading identity, not decoration. For example, `0.41`,
`0.42`, `0.40`, and `0.43` collapse to fewer than four choices under `decimal`,
so that template is rejected. Use `number` when hundredth-level distinctions
matter and fixed trailing zeros do not. If a non-currency question specifically
requires a fixed two-decimal display such as `0.40`, schema v2 cannot represent
that requirement; do not approximate it with `money` or publish it until the
contract gains an appropriate format.

Prefer scaled-integer expressions such as `hundredths / 100` over long chains of
decimal arithmetic. Test minimum, representative middle, and maximum parameter
values plus many deterministic seeds. At every tested value, compare the
**formatted strings** and confirm one correct answer and at least three distinct
distractors remain.

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

The unauthenticated demo PDF endpoint prints all eleven activities shown in the
Explore packs kid view, in the same order. It includes the triangle and prism
diagrams, readable formulas, the authored animal image and alt text, every
choice or response area, and a separate answer key. The endpoint does not create
a learner session or retain attempt data. The backend image packages the shared
bitmap and locates it through `RABBIT_DEMO_ASSET_DIRECTORY`, because container
module paths differ from the source-repository layout.

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
`publicationStatus`, `subject`, `title`, and `locale`. The optional
`practiceQuestionCount` sets the normal learner-session length for that bank from
1 to 20; omitting it keeps the 10-question default. Validate the whole file, then
property-test many seeds because JSON Schema cannot prove that computed options
remain distinct.

Use one bank for a coherent broad subject or course, even when it contains many
subtopics. Each template's stable `skill` is the topic-selection boundary used by
practice and worksheet tools. Separate files are appropriate for independent
publication lifecycles such as different grades, locales, curriculum authorities,
or review owners—not merely because a subject has several topics.

The admin curriculum view deliberately reports templates separately from the
questions they can produce. A template is a reusable generation recipe. For a
fact collection, the basic generation space is the number of facts multiplied
by the number of prompt variants; computed templates can produce combinations
across every allowed parameter value. The admin view exposes these counts, the
complete stored JSON document, and a seeded server-generated preview.

Publishing is an application/content-governance edit lock, not a foreign-key
constraint. Rabbit refuses updates to published bank rows so an administrator
cannot silently change the versioned source of learner activity. Administrators
may explicitly delete imported banks, including published banks. Existing
attempts retain exact resolved snapshots, so prior learner evidence remains
reproducible after a bank is removed from future sessions.

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

Fact collections currently require at least four facts. Each collection declares
one of the following semantic knowledge shapes (the earlier `historical-events`
value remains valid for existing v2 banks):

| `knowledge.type` | Stores | Example question |
| --- | --- | --- |
| `entity-attributes` | A named thing and its properties, such as province → capital, symbol → meaning, or institution → role | “What is the capital of Manitoba?” |
| `relationships` | Linked facts, such as person → contribution, government level → responsibility, or right → protection | “Which level of government is responsible for this service?” |
| `category-membership` | Items assigned to one or more groups, such as province → region or action → citizenship responsibility | “Which province belongs to the Atlantic region?” |
| `process-steps` | Ordered steps with actors and outcomes, such as a federal election, a bill becoming law, or a citizenship application | “What happens after this step?” |
| `scenario-rules` | A short situation, its applicable principle, and an explanation | “A citizen is called for jury duty. Which responsibility applies?” |

Fact fields may be non-empty text, integers, or a non-empty, unique list of text
values. Lists preserve authored order and render as comma-separated text, which
lets `category-membership` represent an item in more than one group. A variant
identifies one answer field and one distractor-pool field; both fields must be
present on every fact. The engine derives three distinct choices from
other facts and rejects a collection that cannot supply them. All distractors in
a variant currently share one misconception route; future content versions may
add per-fact misconception mappings. Selection and option shuffling use the
session's seeded random generator. Internal generation metadata records the
collection's knowledge type as well as its template, variant, and fact IDs.

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

## Parameter field reference

A computed parameter is a named integer domain. The property name must match
`^[a-z][a-z0-9_]*$` and becomes the variable available to expressions. `type` is
currently always `integer`; `min` and `max` are inclusive JSON integers; optional
`step` is an integer of at least 1 and defaults to 1. Thus
`{"type":"integer","min":2,"max":8,"step":2}` permits exactly 2, 4, 6, and 8.
The generator rejects an empty range, unknown variables, unsafe syntax,
non-finite results, and questions that cannot produce four distinct choices.

## Formula and diagram boundaries

Answer, distractor, interpolation, numerator, and denominator expressions share
the numeric DSL: declared variables, numeric constants, parentheses, unary `+`
or `-`, and binary `+`, `-`, `*`, `/`, `//`, and `%`. Powers, comparisons,
Boolean operators, assignment, strings, collections, indexing, attributes, and
function calls are not supported. In a `math` prompt block, reviewed static
KaTeX presentation commands such as `\\times`, `\\div`, `\\frac`, superscripts,
and subscripts may be used. Rendering is strict HTML+MathML with trust disabled;
HTML, links, images, macros, raw SVG, and trust-requiring commands are forbidden.

Normative v2 visuals are closed, declarative objects: `data-table`, `fraction-bar`,
`rectangle-grid`, `angle`, `triangle`, `solid`, and `scene-2d`. Authors describe
meaningful values; Rabbit resolves expressions and compiles the result to its own
web SVG/HTML and PDF primitives. Raw SVG, scripts, styles, URLs, arbitrary markup,
and author-selected colours remain forbidden.

The fraction bar's `numerator` and `denominator` fields are DSL expressions, not final coordinates. For parameters
`shaded` and `total`, an author can use:

```json
{
  "type": "fraction-bar",
  "numerator": "shaded",
  "denominator": "total",
  "alt": "{{shaded}} of {{total}} equal parts are shaded"
}
```

The server resolves those expressions and the client draws equal sanitized
segments. Rectangle grids, angles, triangles, and solids similarly expose only
bounded mathematical dimensions. A data table permits 2–8 columns and up to 20
rows; every resolved row must match the column count. The general `scene-2d`
escape hatch remains bounded to 24 named points in a 0–100 view box, 36 segments,
and 12 polygons. References must name declared points. It cannot carry paths,
scripts, styles, event handlers, foreign resources, or raw SVG.

Every visual requires equivalent `alt` text. Web, history, admin preview, and PDF
renderers consume the same resolved payload. The Docs page includes sliders that update the fraction-bar example immediately.
The exact schema accepted by the validator can also be downloaded from
`GET /api/v1/questions/schema` as `application/schema+json`.

| Visual type | Authored content | Safety and accessibility boundary |
| --- | --- | --- |
| `data-table` | Caption, 2–8 column headings, 1–20 equal-width rows | Text interpolation only; no HTML; `alt` summarizes the table's purpose. |
| `fraction-bar` | Numerator and denominator expressions | Resolved numerator must be from zero through the positive denominator. |
| `rectangle-grid` | Width, height, optional shaded-cell count, and unit | Positive dimensions are capped at 100; shading cannot exceed the cell count. |
| `angle` | Degree expression and optional label | Only non-reflex 1–179 degree angles are accepted. |
| `triangle` | `right` or `isosceles`, base, height, unit, and optional unknown | The renderer owns vertices and marks; authors cannot provide SVG coordinates. |
| `solid` | `rectangular-prism` or `cube`, three dimensions, and unit | Uses a deterministic static projection with the same labelled PDF fallback. |
| `scene-2d` | Named bounded points, segments, optional polygons and labels | IDs are unique, references must exist, and coordinates stay inside 0–100. |


## Self-documenting field guides

The Docs page shows a responsive tree-table immediately below both visible JSON
examples. The bank table explains each top-level path, whether it is required,
its accepted values, and its product meaning. The question table changes with
the selected type: computed templates, fact collections, and fixed-pack
prototypes each receive the relevant field definitions. On narrow screens each
row becomes a labelled card rather than requiring horizontal scrolling.

The Discover Canada prompt is also self-contained. The page fetches the exact
live schema from `GET /api/v1/questions/schema`, appends it inside the prompt,
and enables Copy only after that succeeds. Authors paste official excerpts into
the marked block; they do not need to manage a separate schema attachment.
