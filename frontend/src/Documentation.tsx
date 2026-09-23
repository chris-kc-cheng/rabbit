import { useEffect, useState } from "react";
import { api } from "./api";
import { FractionBar } from "./FractionBar";
import type { ImportError } from "./types";
import "./documentation.css";

type Example = { id: string; label: string; status: string; description: string; json: object };
type FieldRow = { path: string; required: string; accepted: string; meaning: string };

const schemaDefinition = {
  schemaVersion: 2,
  generatorVersion: "2.0.0",
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

const aiPrompt = `You are a careful curriculum-content researcher drafting a Canadian citizenship question bank for an online learning platform, for independent learners aged 10 and above.

INPUTS
1. The question-bank JSON Schema pasted at the end of this prompt (the sole structural contract).
2. Discover Canada excerpts pasted after <DISCOVER_CANADA_EXCERPTS>.

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
Return strict JSON only: no Markdown fences, comments, trailing commas, citations outside the source object, or extra prose. Do not invent fields outside the pasted schema. Before responding, verify every required field, stable-ID pattern, length constraint, distinct year, and interpolation path. This remains an unreviewed draft; only a human may mark it reviewed or published.

<DISCOVER_CANADA_EXCERPTS>
Paste the exact official excerpts here.
</DISCOVER_CANADA_EXCERPTS>`;

const bankFields: FieldRow[] = [
  { path: "schemaVersion", required: "Yes", accepted: "2", meaning: "Question-bank content-contract version. No other value is accepted." },
  { path: "generatorVersion", required: "Yes", accepted: "x.y.z, e.g. 2.0.0", meaning: "Version of the deterministic server generator; use the deployed version." },
  { path: "publicationStatus", required: "Yes", accepted: "draft | published", meaning: "Draft requires review. Published content is treated as immutable." },
  { path: "subject", required: "Yes", accepted: "Stable ID", meaning: "Namespaced catalogue key, using lowercase letters, digits, dots, or hyphens." },
  { path: "title", required: "Yes", accepted: "1–100 characters", meaning: "Human-readable subject title shown in the interface." },
  { path: "locale", required: "Yes", accepted: "xx-YY, e.g. en-CA", meaning: "Language and region used by wording and formatting." },
  { path: "templates[]", required: "Yes", accepted: "1 or more templates", meaning: "Computed single-select or fact-collection-single-select definitions." },
];

const computedFields: FieldRow[] = [
  { path: "id", required: "Yes", accepted: "Stable ID", meaning: "Immutable namespaced identity, e.g. math.multiply.groups." },
  { path: "version", required: "Yes", accepted: "Integer ≥ 1", meaning: "Increase rather than editing a published template." },
  { path: "type", required: "Yes", accepted: "single-select", meaning: "Selects the computed, server-graded template shape." },
  { path: "skill", required: "Yes", accepted: "Stable ID", meaning: "Mastery skill this question provides evidence for." },
  { path: "difficulty", required: "Yes", accepted: "Integer 1–5", meaning: "1 is introductory; 5 is the most demanding." },
  { path: "parameters.<name>", required: "Yes", accepted: "Integer domain", meaning: "Named generated value: type=integer, inclusive min/max, optional step ≥ 1." },
  { path: "prompt[]", required: "Yes", accepted: "text | math blocks", meaning: "Ordered learner-visible content; values are 1–500 characters." },
  { path: "answer", required: "Yes", accepted: "expression + number|decimal|money", meaning: "Server-only correct expression and its display format." },
  { path: "distractors[]", required: "Yes", accepted: "At least 3", meaning: "Stable misconception routes with distinct expressions and supportive feedback." },
  { path: "hint / explanation", required: "Yes", accepted: "5–250 / 10–500 chars", meaning: "Learner support and the worked solution; both allow safe interpolation." },
  { path: "visual", required: "No", accepted: "fraction-bar", meaning: "Expression-based numerator/denominator plus accessible alt text." },
  { path: "accessibility.screenReaderText", required: "Yes", accepted: "5–500 characters", meaning: "Equivalent prompt meaning for non-visual use." },
];

const factFields: FieldRow[] = [
  { path: "id / version / skill", required: "Yes", accepted: "Stable IDs; version ≥ 1", meaning: "Identity, immutable revision, and evidence skill." },
  { path: "type", required: "Yes", accepted: "fact-collection-single-select", meaning: "Selects the reusable reviewed-facts template shape." },
  { path: "knowledge.type", required: "Yes", accepted: "historical-events", meaning: "Current v2 fact collection category." },
  { path: "knowledge.facts[]", required: "Yes", accepted: "At least 4 objects", meaning: "Each needs stable id plus at least two scalar string/integer fields; distractor values must be distinct." },
  { path: "variants[]", required: "Yes", accepted: "At least 1 variant", meaning: "Defines prompt, difficulty 1–5, answer field, distractor pool, feedback, hint, explanation, and accessibility." },
  { path: "answerField", required: "Yes", accepted: "Fact field name", meaning: "Field containing the correct answer, such as year." },
  { path: "distractorPoolField", required: "Yes", accepted: "Fact field name", meaning: "Field used to draw three answers from other facts." },
  { path: "source", required: "Yes", accepted: "title, URI, locator, draft|reviewed", meaning: "Exact provenance and human-review state for the facts." },
];

const prototypeFields: FieldRow[] = [
  { path: "id", required: "Yes", accepted: "1–80 character unique ID", meaning: "Identity inside the fixed demo pack." },
  { path: "subject", required: "Yes", accepted: "math | trivia | english | canadian-citizenship", meaning: "Demo navigation category." },
  { path: "kind", required: "Yes", accepted: "single-select | multi-select | fill-blank | reorder | correction", meaning: "Determines the response control and server grading route." },
  { path: "title / instruction", required: "Yes", accepted: "Non-empty learner-facing text", meaning: "Activity label and exact task shown to the learner." },
  { path: "choices[]", required: "For select kinds", accepted: "Stable id + visible label", meaning: "Options; multi-select answers contain every correct choice ID." },
  { path: "tiles[]", required: "For reorder", accepted: "Stable id + visible label", meaning: "Movable words; answer contains IDs in correct order." },
  { path: "placeholder", required: "For typed kinds", accepted: "Short text", meaning: "Input guidance, not an answer hint." },
  { path: "answer", required: "Yes (server only)", accepted: "Choice ID, ID array, or text", meaning: "Shape depends on kind and is removed from public sessions." },
  { path: "feedback", required: "Yes (server only)", accepted: "Supportive text", meaning: "Returned after submission; removed from public sessions beforehand." },
];

function FieldGuide({ title, rows }: { title: string; rows: FieldRow[] }) {
  return <div className="field-guide"><div className="field-guide-heading"><div><span>Tree-table reference</span><h3>{title}</h3></div><small>Required · accepted values · meaning</small></div><div role="table" aria-label={`${title} fields`}><div className="field-guide-header" role="row"><strong role="columnheader">JSON path</strong><strong role="columnheader">Required</strong><strong role="columnheader">Accepted values</strong><strong role="columnheader">What it means</strong></div>{rows.map(row => <div className="field-guide-row" role="row" key={row.path}><code role="cell">{row.path}</code><span role="cell" data-label="Required">{row.required}</span><strong role="cell" data-label="Accepted">{row.accepted}</strong><p role="cell">{row.meaning}</p></div>)}</div></div>;
}

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

function CodeBlock({ value, label, copyDisabled = false }: { value: string; label: string; copyDisabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  return <div className="docs-code"><div><span>{label}</span><button type="button" onClick={copy} disabled={copyDisabled}>{copied ? "Copied!" : copyDisabled ? "Loading…" : "Copy"}</button></div><pre tabIndex={0}><code>{value}</code></pre></div>;
}

export function Documentation() {
  const [selected, setSelected] = useState(examples[0].id);
  const [jsonInput, setJsonInput] = useState("");
  const [validation, setValidation] = useState<{ state: "idle" | "checking" | "valid" | "invalid"; message?: string; errors?: ImportError[] }>({ state: "idle" });
  const [questionSchema, setQuestionSchema] = useState<object | null>(null);
  const [schemaLoadError, setSchemaLoadError] = useState(false);
  const example = examples.find(item => item.id === selected) ?? examples[0];
  const exampleFields = example.id === "single-select" ? computedFields : example.id === "fact-collection" ? factFields : prototypeFields;
  useEffect(() => {
    api.getQuestionSchema().then(setQuestionSchema).catch(() => setSchemaLoadError(true));
  }, []);
  const completeAiPrompt = questionSchema
    ? `${aiPrompt}\n\n<QUESTION_BANK_V2_SCHEMA>\n${JSON.stringify(questionSchema, null, 2)}\n</QUESTION_BANK_V2_SCHEMA>`
    : `${aiPrompt}\n\n<QUESTION_BANK_V2_SCHEMA>\n${schemaLoadError ? "Schema could not be loaded. Reload this page before copying the prompt." : "Loading the exact schema…"}\n</QUESTION_BANK_V2_SCHEMA>`;
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
    <header className="docs-hero"><div><p className="eyebrow">Question authoring guide</p><h1>Build a question.<br/><em>Keep curiosity safe.</em></h1><p>Use the JSON contracts to create reproducible, accessible questions. Answers and grading metadata always stay on the server.</p></div><div className="docs-version"><span>Current contract</span><strong>Question bank v2</strong><small>JSON Schema 2020-12</small></div></header>

    <nav className="docs-jump" aria-label="Documentation sections"><a href="#definition">Definition</a><a href="#parameters">Parameters</a><a href="#examples">Examples</a><a href="#rendering">Rendering</a><a href="#validator">Validator</a><a href="#ai-prompt">AI prompt</a></nav>

    <section className="docs-section" id="definition"><div className="docs-section-copy"><p className="docs-kicker">01 · Definition</p><h2>A small, explicit JSON contract</h2><p>A bank is a versioned envelope around immutable templates. The normative contract supports computed and fact-collection single-select questions. Experimental interaction types use the separate demo-pack contract.</p><ul><li><strong>Reproducible</strong><span>Template version, generator version, and seed identify a generated question.</span></li><li><strong>Private by design</strong><span>Public sessions omit answers and misconception metadata until grading.</span></li><li><strong>Safe to evaluate</strong><span>Expressions use the restricted arithmetic DSL—never <code>eval</code> or authored scripts.</span></li></ul></div><CodeBlock label="Bank envelope · JSON" value={JSON.stringify(schemaDefinition, null, 2)} /><FieldGuide title="Bank envelope explained" rows={bankFields} /></section>

    <section className="docs-parameters" id="parameters"><div className="docs-title-row"><div><p className="docs-kicker">02 · Parameters</p><h2>Know exactly what each value means</h2></div><div><p>A parameter is a named whole number sampled by the server. Both bounds are included. For <code>{'{ "min": 2, "max": 8, "step": 2 }'}</code>, allowable values are <strong>2, 4, 6, 8</strong>.</p><a className="schema-download" href="/api/v1/questions/schema" download>↓ Download the complete AI-ready JSON Schema</a></div></div><div className="parameter-table" role="table" aria-label="Parameter fields and allowed values">{parameterRows.map(([field, allowed, meaning]) => <div role="row" key={field}><code role="cell">{field}</code><strong role="cell">{allowed}</strong><span role="cell">{meaning}</span></div>)}</div><div className="parameter-notes"><p><strong>Example:</strong> <code>groups</code> from 2–8 and <code>size</code> from 2–9 may be referenced as <code>groups * size</code> or inside text as <code>{'{{groups * size}}'}</code>.</p><p><strong>Important:</strong> the schema checks types and shapes. The validator also generates questions to catch unknown variables, division by zero, unsafe syntax, and duplicate answer choices.</p></div></section>

    <section className="docs-examples" id="examples"><div className="docs-title-row"><div><p className="docs-kicker">03 · Examples</p><h2>One example for every question type</h2></div><p>Published types follow the normative v2 schema. Prototype types use the separate <code>demo-pack.schema.json</code>, demonstrate future interactions, and cannot be imported into a v2 bank.</p></div><div className="docs-example-layout"><div className="docs-type-list" role="tablist" aria-label="Question types">{examples.map(item => <button key={item.id} type="button" role="tab" aria-selected={selected === item.id} className={selected === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><span>{item.label}</span><small>{item.status}</small></button>)}</div><article className="docs-example-card"><div className="docs-example-head"><div><span className={example.status === "Prototype" ? "prototype" : "published"}>{example.status}</span><h3>{example.label}</h3><p>{example.description}</p></div><span className="json-mark" aria-hidden="true">{'{ }'}</span></div><CodeBlock label={`${example.id}.json`} value={JSON.stringify(example.json, null, 2)} /><FieldGuide title={`${example.label} JSON explained`} rows={exampleFields} /></article></div></section>

    <section className="docs-rendering" id="rendering"><div className="docs-title-row"><div><p className="docs-kicker">04 · Formula & diagram playground</p><h2>Safe pieces, rendered live</h2></div><p>Calculation and presentation are separate. The expression DSL computes answers and diagram values; restricted LaTeX in a <code>math</code> prompt block controls only how a formula looks.</p></div><div className="formula-grid"><article><h3>Expression DSL · supported</h3><p>Declared variables; integer or decimal constants; parentheses; unary <code>+</code>/<code>-</code>; and binary <code>+ - * / // %</code>.</p><code>(groups * size) + 2</code></article><article className="not-supported"><h3>Not supported</h3><p>Powers, comparisons, Boolean logic, assignments, strings, arrays, indexing, attributes, function calls such as <code>sqrt()</code>, or any Python/JavaScript.</p><code>pow(a, 2) · a ** 2 · Math.random()</code></article><article><h3>Restricted LaTeX display</h3><p>Use static, reviewed KaTeX such as <code>\times</code>, <code>\div</code>, <code>\frac{'{a}{b}'}</code>, superscripts, subscripts, and grouping. The interface renders strict HTML+MathML with trust disabled.</p><code>{'{{a}} + {{b}} \\times {{c}}'}</code></article><article className="not-supported"><h3>LaTeX not accepted</h3><p>No HTML, links, images, macros, raw SVG, embedded commands, or trust-requiring commands such as <code>\href</code>, <code>\includegraphics</code>, or <code>\htmlClass</code>.</p></article></div><DiagramPlayground /></section>

    <section className="docs-validator" id="validator"><div className="docs-validator-copy"><p className="docs-kicker">05 · Validate your JSON</p><h2>Test before you publish</h2><p>Paste or upload a <strong>complete bank document</strong>, not one template. The validator checks the normative schema and runs a seeded generation test. Nothing is imported or retained.</p><button className="docs-file" type="button" onClick={() => setJsonInput(JSON.stringify({ ...schemaDefinition, generatorVersion: "2.0.0", templates: [examples[0].json] }, null, 2))}>Load a valid starter</button><label className="docs-file">Upload a JSON file<input type="file" accept="application/json,.json" onChange={event => loadFile(event.target.files?.[0])} /></label></div><div className="docs-validator-tool"><label htmlFor="question-json">Question-bank JSON</label><textarea id="question-json" value={jsonInput} onChange={event => { setJsonInput(event.target.value); setValidation({ state: "idle" }); }} placeholder={'{\n  "schemaVersion": 2,\n  ...\n}'} spellCheck={false} /><button className="primary" type="button" onClick={validate} disabled={!jsonInput.trim() || validation.state === "checking"}>{validation.state === "checking" ? "Checking…" : "Test JSON"}</button><div className={`docs-validation-result ${validation.state}`} aria-live="polite">{validation.message && <strong>{validation.message}</strong>}{validation.errors?.map((error, index) => <div key={`${error.path}-${index}`}><code>{error.path}</code><span>{error.message}</span><small>{error.suggestion}</small></div>)}</div></div></section>

    <section className="docs-ai" id="ai-prompt"><div className="docs-ai-copy"><p className="docs-kicker">06 · Discover Canada AI draft</p><h2>One self-contained prompt</h2><p>No attachment is required. This page loads the exact live schema and includes it inside the copyable prompt. Replace the excerpt, topic, URL, and locator placeholders, then paste the whole prompt into the AI tool.</p><div className="docs-callout"><strong>Human review is required</strong><span>Compare every fact with Discover Canada, check age fit and accessibility, validate the JSON, and leave both source and bank in draft status until approved.</span></div>{schemaLoadError && <p className="schema-error" role="alert">The schema did not load, so copying is disabled until you reload this page.</p>}</div><CodeBlock label={questionSchema ? "Complete prompt + embedded JSON Schema" : "Preparing complete prompt…"} value={completeAiPrompt} copyDisabled={!questionSchema} /></section>
  </main>;
}
