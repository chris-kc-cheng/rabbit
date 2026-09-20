# Rabbit JSON question bank

## Normative files

- `content/question-template.schema.json` is the JSON Schema Draft 2020-12
  contract for a complete bank.
- `content/math.question-bank.json` is the executable ten-template elementary
  math bank loaded by FastAPI.

The current v1 type is `single-select`. Each template has bounded parameters,
structured prompt blocks, a server-side answer expression, and at least three
wrong-answer routes. Each wrong route has a stable misconception ID and feedback.
The expression language permits numeric constants, declared variables,
parentheses, and `+`, `-`, `*`, `/`, `//`, and `%`. It never executes Python or
JavaScript.

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

A bank wraps templates with `schemaVersion`, `subject`, and `locale`. Validate the
whole file, then property-test many seeds because JSON Schema cannot prove that
computed options remain distinct.

## Publishing rules

AI output is always a draft. A curriculum reviewer must verify math, age fit,
parameter extremes, all misconception mappings, accessibility, and supportive
language before publication. Version published templates rather than editing them
in place. The current prototype reads Git-managed JSON at startup; database
publishing and immutable snapshots remain to be implemented.
