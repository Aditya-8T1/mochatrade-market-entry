import type { ReactElement } from "react";

export interface RadarAxis {
  key: string;
  label: string;
  value: number; // 1-5
  weight: number; // 0-1, shown as the axis's share
}

const SIZE = 236;
const CENTER = SIZE / 2;
const MAX_R = 86;
const SCALE_MAX = 5;

function point(index: number, count: number, r: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function poly(points: [number, number][]): string {
  return points.map((p) => p.join(",")).join(" ");
}

/** Pentagon radar of the 5 rubric dimensions -- axis length = weight, fill shape = raw score. */
export default function RadarChart({ axes }: { axes: RadarAxis[] }): ReactElement {
  const n = axes.length;
  const rings = [1, 2, 3, 4, 5];
  const valuePoints = axes.map((a, i) => point(i, n, (Math.min(a.value, SCALE_MAX) / SCALE_MAX) * MAX_R));
  const weightPoints = axes.map((a, i) => point(i, n, (a.weight / 0.4) * MAX_R * 0.94));

  return (
    <svg
      viewBox={`-92 0 ${SIZE + 184} ${SIZE + 34}`}
      className="w-full max-w-[360px]"
      role="img"
      aria-label="Rubric radar chart"
    >
      <g>
        {rings.map((r) => (
          <polygon
            key={r}
            points={poly(Array.from({ length: n }, (_, i) => point(i, n, (r / SCALE_MAX) * MAX_R)))}
            fill="none"
            stroke="#E4DDD0"
            strokeWidth={r === 5 ? 1.2 : 0.8}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, n, MAX_R);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#E4DDD0" strokeWidth={0.7} />;
        })}

        {/* weight envelope -- how much each axis counts toward the score */}
        <polygon points={poly(weightPoints)} fill="rgba(122,79,176,0.06)" stroke="#7A4FB0" strokeWidth={1} strokeDasharray="2 3" />

        {/* raw score shape */}
        <polygon points={poly(valuePoints)} fill="rgba(184,71,31,0.12)" stroke="#B8471F" strokeWidth={2} />
        {valuePoints.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.75} fill="#FFFFFF" stroke="#B8471F" strokeWidth={2} />
        ))}

        {axes.map((a, i) => {
          const [lx, ly] = point(i, n, MAX_R + 22);
          const anchor = Math.abs(lx - CENTER) < 4 ? "middle" : lx > CENTER ? "start" : "end";
          return (
            <text
              key={a.key}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-ink-2"
              style={{ fontSize: 15, fontFamily: "Karla, sans-serif", fontWeight: 700 }}
            >
              {a.label}
            </text>
          );
        })}
      </g>
      <g transform={`translate(20, ${SIZE + 8})`}>
        <line x1={0} y1={4} x2={14} y2={4} stroke="#B8471F" strokeWidth={2} />
        <text x={19} y={9} className="fill-ink-2" style={{ fontSize: 15, fontFamily: "Karla, sans-serif", fontWeight: 700 }}>
          score (1-5)
        </text>
        <line x1={128} y1={4} x2={142} y2={4} stroke="#7A4FB0" strokeWidth={1.4} strokeDasharray="2 3" />
        <text x={147} y={9} className="fill-ink-2" style={{ fontSize: 15, fontFamily: "Karla, sans-serif", fontWeight: 700 }}>
          weight
        </text>
      </g>
    </svg>
  );
}
