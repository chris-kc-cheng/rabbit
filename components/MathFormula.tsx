import katex from "katex";

export function MathFormula({ latex }: { latex: string }) {
  const markup = katex.renderToString(latex, {
    displayMode: true,
    output: "htmlAndMathml",
    strict: "error",
    trust: false,
  });

  return <div className="math-formula" dangerouslySetInnerHTML={{ __html: markup }} />;
}
