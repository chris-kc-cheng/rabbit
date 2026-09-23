import { FractionBar } from "./FractionBar";
import type { QuestionVisual as Visual } from "./types";

const line = "var(--purple)";
const fill = "var(--soft)";

export function QuestionVisual({ visual }: { visual: Visual }) {
  if (visual.type === "fraction-bar") return <FractionBar {...visual} />;
  if (visual.type === "data-table") return <figure className="question-table"><figcaption>{visual.caption}</figcaption><table><thead><tr>{visual.columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead><tbody>{visual.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table><p className="sr-only">{visual.alt}</p></figure>;
  if (visual.type === "rectangle-grid") {
    const cells = visual.width * visual.height; const shaded = visual.shaded ?? 0;
    return <svg className="question-diagram" viewBox="0 0 440 230" role="img" aria-label={visual.alt}><title>{visual.alt}</title>{Array.from({ length: cells }, (_, index) => { const column = index % visual.width; const row = Math.floor(index / visual.width); return <rect key={index} x={50 + column * 320 / visual.width} y={25 + row * 160 / visual.height} width={320 / visual.width} height={160 / visual.height} fill={index < shaded ? line : fill} stroke={line} />; })}<text x="210" y="215" textAnchor="middle">{visual.width} {visual.unit}</text><text x="25" y="110" textAnchor="middle" transform="rotate(-90 25 110)">{visual.height} {visual.unit}</text></svg>;
  }
  if (visual.type === "angle") {
    const radians = visual.degrees * Math.PI / 180; const x = 210 + 130 * Math.cos(radians); const y = 180 - 130 * Math.sin(radians);
    return <svg className="question-diagram" viewBox="0 0 440 230" role="img" aria-label={visual.alt}><title>{visual.alt}</title><line x1="210" y1="180" x2="350" y2="180" stroke={line} strokeWidth="4" /><line x1="210" y1="180" x2={x} y2={y} stroke={line} strokeWidth="4" /><path d={`M 255 180 A 45 45 0 0 0 ${210 + 45 * Math.cos(radians)} ${180 - 45 * Math.sin(radians)}`} fill="none" stroke={line} strokeWidth="2" /><text x="255" y="155">{visual.label ?? `${visual.degrees}°`}</text></svg>;
  }
  if (visual.type === "triangle") {
    const apex = visual.kind === "isosceles" ? 220 : 370;
    return <svg className="question-diagram" viewBox="0 0 440 230" role="img" aria-label={visual.alt}><title>{visual.alt}</title><polygon points={`70,185 370,185 ${apex},35`} fill={fill} stroke={line} strokeWidth="4" /><text x="220" y="215" textAnchor="middle">{visual.unknown === "base" ? "?" : `${visual.base} ${visual.unit}`}</text><text x={visual.kind === "right" ? 380 : 310} y="105">{visual.unknown === "height" ? "?" : `${visual.height} ${visual.unit}`}</text>{visual.kind === "right" && <path d="M 342 185 v-28 h28" fill="none" stroke={line} strokeWidth="2" />}</svg>;
  }
  if (visual.type === "solid") return <svg className="question-diagram" viewBox="0 0 440 240" role="img" aria-label={visual.alt}><title>{visual.alt}</title><rect x="90" y="65" width="220" height="125" fill={fill} stroke={line} strokeWidth="3" /><polygon points="90,65 140,30 360,30 310,65" fill="white" stroke={line} strokeWidth="3" /><polygon points="310,65 360,30 360,155 310,190" fill="var(--subtle)" stroke={line} strokeWidth="3" /><text x="200" y="220">{visual.length} {visual.unit}</text><text x="365" y="105">{visual.height} {visual.unit}</text><text x="325" y="25">{visual.width} {visual.unit}</text></svg>;
  const points = new Map(visual.points.map(point => [point.id, point]));
  const xy = (id: string) => { const point = points.get(id)!; return { x: 30 + point.x * 3.8, y: 210 - point.y * 1.8 }; };
  return <svg className="question-diagram" viewBox="0 0 440 240" role="img" aria-label={visual.alt}><title>{visual.alt}</title>{visual.polygons?.map((polygon, index) => <polygon key={index} points={polygon.points.map(id => { const point = xy(id); return `${point.x},${point.y}`; }).join(" ")} fill={polygon.shaded ? fill : "transparent"} stroke={line} strokeWidth="2" />)}{visual.segments.map((segment, index) => { const from = xy(segment.from); const to = xy(segment.to); return <g key={index}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={line} strokeWidth="3" />{segment.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 7} textAnchor="middle">{segment.label}</text>}</g>; })}{visual.points.map(point => { const position = xy(point.id); return <g key={point.id}><circle cx={position.x} cy={position.y} r="4" fill={line} />{point.label && <text x={position.x + 7} y={position.y - 7}>{point.label}</text>}</g>; })}</svg>;
}
