export function FractionBar({ numerator, denominator, alt }: { numerator: number; denominator: number; alt: string }) {
  return (
    <svg viewBox="0 0 420 86" role="img" aria-label={alt} className="fraction-bar">
      <title>{alt}</title>
      {Array.from({ length: denominator }, (_, index) => (
        <rect key={index} x={index * (420 / denominator) + 2} y="8" width={420 / denominator - 4} height="64" rx="7"
          fill={index < numerator ? "#6c5ce7" : "#f1effb"} stroke="#d7d1ef" strokeWidth="2" />
      ))}
    </svg>
  );
}
