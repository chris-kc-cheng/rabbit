import { useState } from "react";
import { api } from "./api";
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

const aiPrompt = `You are drafting curriculum content for Rabbit, a positive learning platform for students aged 10 and above. Create one elementary-math single-select template for <SKILL> at difficulty <1-5>, using Canadian English.

Return one strict JSON object matching one item in the templates array of the attached Rabbit question-bank v2 schema. Output JSON only—no Markdown, comments, trailing commas, or extra prose.

Use a stable namespaced id, version 1, bounded integer parameters, structured prompt blocks, one answer expression, at least three distinct misconception-based distractors, a helpful hint, worked explanation, and screen-reader text. Use only declared variables, numbers, parentheses, +, -, *, /, //, and %. Never output executable code, HTML, raw SVG, URLs in content, or untrusted LaTeX.

Silently test minimum, middle, and maximum parameter values. Keep every value finite and every choice distinct. Use supportive language and avoid ambiguity, personal data, stereotypes, advertising, or reward promises. The result is a draft until a human curriculum reviewer approves it.`;

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

    <nav className="docs-jump" aria-label="Documentation sections"><a href="#definition">Definition</a><a href="#examples">Examples</a><a href="#validator">Validator</a><a href="#ai-prompt">AI prompt</a></nav>

    <section className="docs-section" id="definition"><div className="docs-section-copy"><p className="docs-kicker">01 · Definition</p><h2>A small, explicit JSON contract</h2><p>A bank is a versioned envelope around immutable templates. The normative contract supports computed and fact-collection single-select questions. Experimental interaction types use the separate demo-pack contract.</p><ul><li><strong>Reproducible</strong><span>Template version, generator version, and seed identify a generated question.</span></li><li><strong>Private by design</strong><span>Public sessions omit answers and misconception metadata until grading.</span></li><li><strong>Safe to evaluate</strong><span>Expressions use Rabbit’s arithmetic DSL—never <code>eval</code> or authored scripts.</span></li></ul></div><CodeBlock label="Bank envelope · JSON" value={JSON.stringify(schemaDefinition, null, 2)} /></section>

    <section className="docs-examples" id="examples"><div className="docs-title-row"><div><p className="docs-kicker">02 · Examples</p><h2>One example for every question type</h2></div><p>Published types follow the normative v2 schema. Prototype types demonstrate the planned interaction contract and still require review before publication.</p></div><div className="docs-example-layout"><div className="docs-type-list" role="tablist" aria-label="Question types">{examples.map(item => <button key={item.id} type="button" role="tab" aria-selected={selected === item.id} className={selected === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><span>{item.label}</span><small>{item.status}</small></button>)}</div><article className="docs-example-card"><div className="docs-example-head"><div><span className={example.status === "Prototype" ? "prototype" : "published"}>{example.status}</span><h3>{example.label}</h3><p>{example.description}</p></div><span className="json-mark" aria-hidden="true">{'{ }'}</span></div><CodeBlock label={`${example.id}.json`} value={JSON.stringify(example.json, null, 2)} /></article></div></section>

    <section className="docs-validator" id="validator"><div className="docs-validator-copy"><p className="docs-kicker">03 · Validate your JSON</p><h2>Test before you publish</h2><p>Paste or upload a complete question-bank v2 document. Rabbit checks it against the normative JSON Schema and runs a seeded generation test. The document is tested only—it is not imported or retained.</p><label className="docs-file">Upload a JSON file<input type="file" accept="application/json,.json" onChange={event => loadFile(event.target.files?.[0])} /></label></div><div className="docs-validator-tool"><label htmlFor="question-json">Question-bank JSON</label><textarea id="question-json" value={jsonInput} onChange={event => { setJsonInput(event.target.value); setValidation({ state: "idle" }); }} placeholder={'{\n  "schemaVersion": 2,\n  ...\n}'} spellCheck={false} /><button className="primary" type="button" onClick={validate} disabled={!jsonInput.trim() || validation.state === "checking"}>{validation.state === "checking" ? "Checking…" : "Test JSON"}</button><div className={`docs-validation-result ${validation.state}`} aria-live="polite">{validation.message && <strong>{validation.message}</strong>}{validation.errors?.map((error, index) => <div key={`${error.path}-${index}`}><code>{error.path}</code><span>{error.message}</span><small>{error.suggestion}</small></div>)}</div></div></section>

    <section className="docs-ai" id="ai-prompt"><div className="docs-ai-copy"><p className="docs-kicker">04 · AI-assisted draft</p><h2>Start with a careful prompt</h2><p>Attach the complete normative schema before sending this prompt. Treat every response as an untrusted draft: validate the JSON, property-test generated choices, and require human curriculum review.</p><div className="docs-callout"><strong>Human review is required</strong><span>Check correctness, age fit, parameter extremes, accessibility, source quality, and supportive feedback before publishing.</span></div></div><CodeBlock label="Sample authoring prompt · text" value={aiPrompt} /></section>
  </main>;
}
