import katex from "katex";

export function MathBlock({ value }: { value: string }) {
  const markup = katex.renderToString(value, { displayMode: true, output: "htmlAndMathml", strict: "error", trust: false });
  return <div className="math" dangerouslySetInnerHTML={{ __html: markup }} />;
}
