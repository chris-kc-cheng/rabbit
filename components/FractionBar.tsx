export function FractionBar({ numerator, denominator }: { numerator: number; denominator: number }) {
  const width = 420;
  const cellWidth = width / denominator;

  return (
    <svg className="fraction-bar" viewBox={`0 0 ${width} 92`} role="img" aria-label={`${numerator} of ${denominator} equal parts shaded`}>
      <title>{`${numerator} of ${denominator} equal parts are shaded`}</title>
      {Array.from({ length: denominator }, (_, index) => (
        <rect
          key={index}
          x={index * cellWidth + 1}
          y="8"
          width={cellWidth - 2}
          height="68"
          rx="7"
          fill={index < numerator ? "#6c5ce7" : "#f1effb"}
          stroke={index < numerator ? "#5746d9" : "#d8d3ef"}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
