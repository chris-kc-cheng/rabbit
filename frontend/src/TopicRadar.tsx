export type TopicEvidence = { skill: string; correct: number; total: number; accuracy: number };

const shortName = (skill: string) => skill.split(".").slice(-2).join(" ").replaceAll("-", " ");

export function TopicRadar({ evidence, title = "Strength by topic" }: { evidence: TopicEvidence[]; title?: string }) {
  const topics = evidence.slice(0, 6);
  if (topics.length < 3) return <section className="topic-radar empty-radar"><h3>{title}</h3><p>Complete questions in at least three topics to see the learning shape.</p></section>;
  const centre = 100; const radius = 70;
  const point = (index: number, scale = 1) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / topics.length;
    return `${centre + Math.cos(angle) * radius * scale},${centre + Math.sin(angle) * radius * scale}`;
  };
  const polygon = (scale: number) => topics.map((_, index) => point(index, scale)).join(" ");
  const scorePolygon = topics.map((topic, index) => point(index, Math.max(.08, topic.accuracy))).join(" ");
  const summary = topics.map(topic => `${shortName(topic.skill)}: ${Math.round(topic.accuracy * 100)} percent from ${topic.total} answers`).join("; ");
  return <figure className="topic-radar" aria-label={`${title}. ${summary}`}>
    <figcaption>{title}<small>Accuracy · recent evidence</small></figcaption>
    <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
      {[.25, .5, .75, 1].map(scale => <polygon key={scale} points={polygon(scale)} className="radar-grid" />)}
      {topics.map((_, index) => <line key={index} x1={centre} y1={centre} x2={point(index).split(",")[0]} y2={point(index).split(",")[1]} className="radar-axis" />)}
      <polygon points={scorePolygon} className="radar-score" />
      {topics.map((topic, index) => { const [x, y] = point(index, 1.18).split(",").map(Number); return <text key={topic.skill} x={x} y={y} textAnchor={x < 80 ? "end" : x > 120 ? "start" : "middle"}>{shortName(topic.skill)}</text>; })}
    </svg>
    <ul className="sr-only">{topics.map(topic => <li key={topic.skill}>{shortName(topic.skill)}: {topic.correct} of {topic.total} correct</li>)}</ul>
  </figure>;
}
