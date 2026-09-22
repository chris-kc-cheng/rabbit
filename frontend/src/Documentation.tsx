import { useState } from "react";
import { api } from "./api";
import { FractionBar } from "./FractionBar";
import type { ImportError } from "./types";
import "./documentation.css";

type Example = { id: string; label: string; status: string; description: string; json: object };

const schemaDefinition = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  schemaVersion: 2,
  generatorVersion: "rabbit-generator-v2",
  publicationStatus: "draft",
  subject: "math",
  title: "My question bank",
  locale: "en-CA",
  templates: ["computed single-select or fact-collection-single-select"]
};

const examples: Example[] = [
  { id: "single-select", label: "Single select", status: "Published contract", description: "One server-graded answer with stable, misconception-based distractors.", json: {
    id: "math.multiply.groups", version: 1, type: "single-select", skill: "math.multiplication", difficulty: 2,
    parameters: { groups: { type: "integer", min: 2, max: 8 }, size: { type: "integer", min: 2, max: 9 } },
    prompt: [{ type: "text", value: "Chloe has {{groups}} boxes with {{size}} pencils in each. How many pencils are there?" }],
    answer: { expression: "groups * size", format: "number" },
    distractors: [
      { id: "add", misconception: "math.multiply.as-addition", expression: "groups + size", feedback: "Equal groups call for multiplication. Try groups × size." },
      { id: "one-group", misconception: "math.multiply.one-group", expression: "size", feedback: "That is one box. Include every box." },
      { id: "off-by-one", misconception: "math.multiply.missed-group", expression: "(groups - 1) * size", feedback: "Count all of the boxes, including the last one." }
    ], hint: "Think about equal groups.", explanation: "Multiply {{groups}} × {{size}} = {{groups * size}}.",
    accessibility: { screenReaderText: "Find the total number of pencils in equal groups." }
  }},
  { id: "fact-collection", label: "Fact collection", status: "Published contract", description: "Reusable reviewed facts generate many reproducible single-select questions.", json: {
    id: "history.events", version: 1, type: "fact-collection-single-select", skill: "history.timeline",
    knowledge: { type: "historical-events", facts: [{ id: "event-a", year: 1867, event: "Confederation" }, { id: "event-b", year: 1873, event: "PEI joined Confederation" }, { id: "event-c", year: 1905, event: "Alberta became a province" }, { id: "event-d", year: 1949, event: "Newfoundland joined Confederation" }] },
    variants: [{ id: "identify-year", difficulty: 2, prompt: [{ type: "text", value: "In what year did {{fact.event}} happen?" }], answerField: "year", distractorPoolField: "year", misconception: "history.timeline.confusion", feedback: "Place the event on the timeline, then compare nearby dates.", hint: "Think about where the event belongs on the timeline.", explanation: "{{fact.event}} happened in {{fact.year}}.", accessibility: { screenReaderText: "Choose the year for the stated historical event." } }],
    source: { title: "Authoritative source title", url: "https://example.ca/source", locator: "Timeline section", reviewStatus: "draft" }
  }},
  { id: "multi-select", label: "Multi select", status: "Prototype", description: "Learners choose every option that applies.", json: { id: "science-mammals-1", subject: "trivia", kind: "multi-select", title: "Animal expert", instruction: "Which TWO animals are mammals?", choices: [{ id: "fox", label: "Fox" }, { id: "frog", label: "Frog" }, { id: "bat", label: "Bat" }, { id: "owl", label: "Owl" }], answer: ["fox", "bat"], feedback: "The fox and bat are mammals." } },
  { id: "fill-blank", label: "Fill in the blank", status: "Prototype", description: "A short typed response, normalized and graded on the server.", json: { id: "english-blank-1", subject: "english", kind: "fill-blank", title: "Fill the gap", instruction: "We stayed inside ___ it was raining.", placeholder: "Type the missing word", answer: "because", feedback: "‘Because’ gives the reason we stayed inside." } },
  { id: "reorder", label: "Reorder", status: "Prototype", description: "Accessible draggable tiles with button controls as an alternative.", json: { id: "english-order-1", subject: "english", kind: "reorder", title: "Build the sentence", instruction: "Put the words in order.", tiles: [{ id: "we", label: "We" }, { id: "learn", label: "learn" }, { id: "together", label: "together" }], answer: ["we", "learn", "together"], feedback: "‘We learn together’ is a complete sentence." } },
  { id: "correction", label: "Correction", status: "Prototype", description: "Learners rewrite a sentence to correct a specific error.", json: { id: "english-correction-1", subject: "english", kind: "correction", title: "Be the editor", instruction: "Correct the grammar: She don't like apples.", placeholder: "Write the corrected sentence", answer: "She doesn't like apples.", feedback: "With ‘she,’ use ‘doesn't.’" } }
];

const aiPrompt = `You are a careful curriculum-content researcher drafting a Canadian citizenship question bank for Rabbit, for independent learners aged 10 and above.

INPUTS
1. The attached rabbit-question-bank-v2.schema.json (the sole structural contract).
2. Excerpts supplied by me from the Government of Canada publication Discover Canada.

TASK
Create one COMPLETE question-bank v2 JSON document, not a lone template. Set schemaVersion to 2, generatorVersion to "2.0.0", publicationStatus to "draft", subject to "canadian-citizenship", locale to "en-CA", and include one fact-collection-single-select template. Focus on <TOPIC_OR_CHAPTER>.

SOURCE RULES
- Use only facts stated explicitly in my supplied Discover Canada excerpts. Do not rely on memory, browse, infer missing dates, or invent citations.
- Store at least four closely related events. Give every fact a stable lowercase ID, integer year, and concise event string.
- Set source.title to "Discover Canada: The Rights and Responsibilities of Citizenship", source.url to the exact URL I supply, source.locator to the exact chapter/page heading, and source.reviewStatus to "draft".

QUESTION RULES
- Add an identify-year variant using answerField and distractorPoolField "year" and {{fact.event}} interpolation.
- Use a stable misconception ID and supportive feedback that explains timeline reasoning without shaming or diagnosing the learner.
- Difficulty is an integer from 1 (introductory recall) to 5 (challenging discrimination).
- Include a useful hint, an explanation that states {{fact.event}} and {{fact.year}}, and meaningful screen-reader text.
- Facts must yield at least four DISTINCT year values so one correct choice and three distractors can always be generated.

OUTPUT RULES
Return strict JSON only: no Markdown fences, comments, trailing commas, citations outside the source object, or extra prose. Do not invent fields outside the attached schema. Before responding, verify every required field, stable-ID pattern, length constraint, distinct year, and interpolation path. This remains an unreviewed draft; only a human may mark it reviewed or published.`;

const parameterRows = [
  ["type", 'Must be "integer"', "Only whole-number parameters are generated."],
  ["min", "Any JSON integer", "Smallest value, inclusive; it must be no greater than max."],
  ["max", "Any JSON integer", "Largest value, inclusive."],
  ["step", "Integer ≥ 1 (optional)", "Spacing from min: min, min + step, … up to max."],
  ["name", "^[a-z][a-z0-9_]*$", "The property key becomes the variable used in expressions."],
];

function DiagramPlayground() {
  const [numerator, setNumerator] = useState(3);
  const [denominator, setDenominator] = useState(8);
  const safeNumerator = Math.min(numerator, denominator);
  const sample = { type: "fraction-bar", numerator: "shaded", denominator: "total", alt: "{{shaded}} of {{total}} equal parts are shaded" };
  return <div className="docs-playground"><div className="playground-controls"><label>shaded · numerator <input type="range" min="0" max={denominator} value={safeNumerator} onChange={event => setNumerator(Number(event.target.value))} /><strong>{safeNumerator}</strong></label><label>total · denominator <input type="range" min="2" max="12" value={denominator} onChange={event => { const next = Number(event.target.value); setDenominator(next); setNumerator(old => Math.min(old, next)); }} /><strong>{denominator}</strong></label></div><div className="playground-preview"><span>Live learner preview</span><FractionBar numerator={safeNumerator} denominator={denominator} alt={`${safeNumerator} of ${denominator} equal parts are shaded`} /></div><CodeBlock label="visual object · JSON" value={JSON.stringify(sample, null, 2)} /><p><strong>How it resolves:</strong> declare <code>shaded</code> and <code>total</code> as integer parameters. The server evaluates the two expressions, sends only the resolved numbers and alt text, and the renderer draws equal sanitized segments. Raw SVG, scripts, coordinates, colours, and arbitrary shapes are not accepted by v2.</p></div>;
}

function CodeBlock({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  return <div className="docs-code"><div><span>{label}</span><button type="button" onClick={copy}>{copied ? "Copied!" : "Copy"}</button></div><pre tabIndex={0}><code>{value}</code></pre></div>;
}

export function Documentation() {
  const [selected, setSelected] = useState(examples[0].id);
  const [jsonInput, setJsonInput] = useState("");
  const [validation, setValidation] = useState<{ state: "idle" | "checking" | "valid" | "invalid"; message?: string; errors?: ImportError[] }>({ state: "idle" });
  const example = examples.find(item => item.id === selected) ?? examples[0];
  const validate = async () => {
    setValidation({ state: "checking" });
    let document: object;
    try {
      document = JSON.parse(jsonInput);
    } catch {
      setValidation({ state: "invalid", message: "This is not valid JSON yet.", errors: [{ path: "$", message: "The JSON could not be parsed.", suggestion: "Check commas, quotation marks, and brackets." }] });
      return;
    }
    if (!document || Array.isArray(document) || typeof document !== "object") {
      setValidation({ state: "invalid", message: "A question bank must be a JSON object.", errors: [{ path: "$", message: "The top-level JSON value must be an object.", suggestion: "Wrap the schema version, subject, title, and templates fields in one JSON object." }] });
      return;
    }
    try {
      const result = await api.validateQuestions(document);
      setValidation({ state: "valid", message: `Valid question bank. ${result.templates_validated} template${result.templates_validated === 1 ? "" : "s"} passed the schema and generation checks.` });
    } catch (caught) {
      const error = caught as Error & { details?: ImportError[] };
      setValidation({ state: "invalid", message: error.message, errors: error.details });
    }
  };
  const loadFile = async (file?: File) => {
    if (!file) return;
    setJsonInput(await file.text());
    setValidation({ state: "idle" });
  };
  return <main className="docs-page">
    <header className="docs-hero"><div><p className="eyebrow">Question authoring guide</p><h1>Build a question.<br/><em>Keep curiosity safe.</em></h1><p>Use Rabbit’s JSON contracts to create reproducible, accessible questions. Answers and grading metadata always stay on the server.</p></div><div className="docs-version"><span>Current contract</span><strong>Question bank v2</strong><small>JSON Schema 2020-12</small></div></header>

    <nav className="docs-jump" aria-label="Documentation sections"><a href="#definition">Definition</a><a href="#parameters">Parameters</a><a href="#examples">Examples</a><a href="#rendering">Rendering</a><a href="#validator">Validator</a><a href="#ai-prompt">AI prompt</a></nav>

    <section className="docs-section" id="definition"><div className="docs-section-copy"><p className="docs-kicker">01 · Definition</p><h2>A small, explicit JSON contract</h2><p>A bank is a versioned envelope around immutable templates. The normative contract supports computed and fact-collection single-select questions. Experimental interaction types use the separate demo-pack contract.</p><ul><li><strong>Reproducible</strong><span>Template version, generator version, and seed identify a generated question.</span></li><li><strong>Private by design</strong><span>Public sessions omit answers and misconception metadata until grading.</span></li><li><strong>Safe to evaluate</strong><span>Expressions use Rabbit’s arithmetic DSL—never <code>eval</code> or authored scripts.</span></li></ul></div><CodeBlock label="Bank envelope · JSON" value={JSON.stringify(schemaDefinition, null, 2)} /></section>

    <section className="docs-parameters" id="parameters"><div className="docs-title-row"><div><p className="docs-kicker">02 · Parameters</p><h2>Know exactly what each value means</h2></div><div><p>A parameter is a named whole number sampled by the server. Both bounds are included. For <code>{'{ "min": 2, "max": 8, "step": 2 }'}</code>, allowable values are <strong>2, 4, 6, 8</strong>.</p><a className="schema-download" href="/api/v1/questions/schema" download>↓ Download the complete AI-ready JSON Schema</a></div></div><div className="parameter-table" role="table" aria-label="Parameter fields and allowed values">{parameterRows.map(([field, allowed, meaning]) => <div role="row" key={field}><code role="cell">{field}</code><strong role="cell">{allowed}</strong><span role="cell">{meaning}</span></div>)}</div><div className="parameter-notes"><p><strong>Example:</strong> <code>groups</code> from 2–8 and <code>size</code> from 2–9 may be referenced as <code>groups * size</code> or inside text as <code>{'{{groups * size}}'}</code>.</p><p><strong>Important:</strong> the schema checks types and shapes. The validator also generates questions to catch unknown variables, division by zero, unsafe syntax, and duplicate answer choices.</p></div></section>

    <section className="docs-examples" id="examples"><div className="docs-title-row"><div><p className="docs-kicker">03 · Examples</p><h2>One example for every question type</h2></div><p>Published types follow the normative v2 schema. Prototype types use the separate <code>demo-pack.schema.json</code>, demonstrate future interactions, and cannot be imported into a v2 bank.</p></div><div className="docs-example-layout"><div className="docs-type-list" role="tablist" aria-label="Question types">{examples.map(item => <button key={item.id} type="button" role="tab" aria-selected={selected === item.id} className={selected === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><span>{item.label}</span><small>{item.status}</small></button>)}</div><article className="docs-example-card"><div className="docs-example-head"><div><span className={example.status === "Prototype" ? "prototype" : "published"}>{example.status}</span><h3>{example.label}</h3><p>{example.description}</p></div><span className="json-mark" aria-hidden="true">{'{ }'}</span></div><CodeBlock label={`${example.id}.json`} value={JSON.stringify(example.json, null, 2)} /></article></div></section>

    <section className="docs-rendering" id="rendering"><div className="docs-title-row"><div><p className="docs-kicker">04 · Formula & diagram playground</p><h2>Safe pieces, rendered live</h2></div><p>Calculation and presentation are separate. The expression DSL computes answers and diagram values; restricted LaTeX in a <code>math</code> prompt block controls only how a formula looks.</p></div><div className="formula-grid"><article><h3>Expression DSL · supported</h3><p>Declared variables; integer or decimal constants; parentheses; unary <code>+</code>/<code>-</code>; and binary <code>+ - * / // %</code>.</p><code>(groups * size) + 2</code></article><article className="not-supported"><h3>Not supported</h3><p>Powers, comparisons, Boolean logic, assignments, strings, arrays, indexing, attributes, function calls such as <code>sqrt()</code>, or any Python/JavaScript.</p><code>pow(a, 2) · a ** 2 · Math.random()</code></article><article><h3>Restricted LaTeX display</h3><p>Use static, reviewed KaTeX such as <code>\times</code>, <code>\div</code>, <code>\frac{'{a}{b}'}</code>, superscripts, subscripts, and grouping. Rabbit renders strict HTML+MathML with trust disabled.</p><code>{'{{a}} + {{b}} \\times {{c}}'}</code></article><article className="not-supported"><h3>LaTeX not accepted</h3><p>No HTML, links, images, macros, raw SVG, embedded commands, or trust-requiring commands such as <code>\href</code>, <code>\includegraphics</code>, or <code>\htmlClass</code>.</p></article></div><DiagramPlayground /></section>

    <section className="docs-validator" id="validator"><div className="docs-validator-copy"><p className="docs-kicker">05 · Validate your JSON</p><h2>Test before you publish</h2><p>Paste or upload a <strong>complete bank document</strong>, not one template. Rabbit checks the normative schema and runs a seeded generation test. Nothing is imported or retained.</p><button className="docs-file" type="button" onClick={() => setJsonInput(JSON.stringify({ ...schemaDefinition, generatorVersion: "2.0.0", templates: [examples[0].json] }, null, 2))}>Load a valid starter</button><label className="docs-file">Upload a JSON file<input type="file" accept="application/json,.json" onChange={event => loadFile(event.target.files?.[0])} /></label></div><div className="docs-validator-tool"><label htmlFor="question-json">Question-bank JSON</label><textarea id="question-json" value={jsonInput} onChange={event => { setJsonInput(event.target.value); setValidation({ state: "idle" }); }} placeholder={'{\n  "schemaVersion": 2,\n  ...\n}'} spellCheck={false} /><button className="primary" type="button" onClick={validate} disabled={!jsonInput.trim() || validation.state === "checking"}>{validation.state === "checking" ? "Checking…" : "Test JSON"}</button><div className={`docs-validation-result ${validation.state}`} aria-live="polite">{validation.message && <strong>{validation.message}</strong>}{validation.errors?.map((error, index) => <div key={`${error.path}-${index}`}><code>{error.path}</code><span>{error.message}</span><small>{error.suggestion}</small></div>)}</div></div></section>

    <section className="docs-ai" id="ai-prompt"><div className="docs-ai-copy"><p className="docs-kicker">06 · Discover Canada AI draft</p><h2>A complete, source-bound prompt</h2><p>Download and attach the normative schema, then attach the exact excerpts and official URL you want the model to use. The prompt deliberately asks for a complete bank so its output can go directly into the validator.</p><div className="docs-callout"><strong>Human review is required</strong><span>Compare every fact with Discover Canada, check age fit and accessibility, validate the JSON, and leave both source and bank in draft status until approved.</span></div></div><CodeBlock label="Discover Canada authoring prompt · text" value={aiPrompt} /></section>
  </main>;
}
