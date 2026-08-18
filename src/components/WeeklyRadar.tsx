import { AnchorType, ANCHOR_TYPES } from "../types";
import { ANCHOR_LABEL } from "../ui";

// Radar geometry. 8 anchors, one axis each, starting at the top and going
// clockwise. MAX is the theoretical max weekly score (intensity 10 * 1.0 * 10).
const CX = 90;
const CY = 74;
const R = 45;
const MAX = 100;

function point(i: number, radius: number): [number, number] {
  const ang = (-90 + i * 45) * (Math.PI / 180);
  return [CX + radius * Math.cos(ang), CY + radius * Math.sin(ang)];
}
function polygon(radii: number[]): string {
  return radii.map((rad, i) => point(i, rad).join(",")).join(" ");
}

export function WeeklyRadar({ scores }: { scores: Record<AnchorType, number> | null }) {
  const hasData = !!scores && ANCHOR_TYPES.some((a) => scores[a] > 0);

  let strongest = "—";
  let weakest = "—";
  let pattern = "No data yet";
  if (hasData && scores) {
    const sorted = ANCHOR_TYPES.map((a) => [a, scores[a]] as const).sort(
      (x, y) => y[1] - x[1],
    );
    strongest = ANCHOR_LABEL[sorted[0][0]];
    weakest = ANCHOR_LABEL[sorted[sorted.length - 1][0]];
    const max = sorted[0][1];
    const min = sorted[sorted.length - 1][1];
    const nonZero = sorted.filter(([, v]) => v > 0).length;
    if (nonZero <= 3) pattern = "Narrow";
    else if (min >= max * 0.5) pattern = "Good coverage";
    else pattern = "Uneven";
  }

  const rings = [R * 0.34, R * 0.67, R];
  const dataRadii = ANCHOR_TYPES.map((a) =>
    scores ? Math.max(0, Math.min(1, scores[a] / MAX)) * R : 0,
  );

  return (
    <section className="card weekly-card">
      <h2 className="weekly-title">Weekly Reflection &amp; Statistics</h2>
      <div className="weekly-body">
        <svg className="radar" viewBox="0 0 180 148" width="180" height="148">
          {rings.map((rad, i) => (
            <polygon
              key={`ring-${i}`}
              points={polygon(Array(8).fill(rad))}
              className={i === rings.length - 1 ? "radar-ring-outer" : "radar-ring-inner"}
            />
          ))}
          {ANCHOR_TYPES.map((_, i) => {
            const [x, y] = point(i, R);
            return <line key={`spoke-${i}`} x1={CX} y1={CY} x2={x} y2={y} className="radar-spoke" />;
          })}
          {hasData && <polygon points={polygon(dataRadii)} className="radar-data" />}
          {hasData &&
            dataRadii.map((rad, i) => {
              const [x, y] = point(i, rad);
              return <circle key={`dot-${i}`} cx={x} cy={y} r={2.4} className="radar-dot" />;
            })}
          {ANCHOR_TYPES.map((a, i) => {
            const ang = (-90 + i * 45) * (Math.PI / 180);
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);
            const [x, y] = point(i, R + 8);
            // Anchor each label outward from its vertex so clearance is even
            // all the way around instead of side labels crowding the grid.
            const anchor = dx > 0.3 ? "start" : dx < -0.3 ? "end" : "middle";
            const baseline = dy > 0.3 ? "hanging" : dy < -0.3 ? "auto" : "middle";
            return (
              <text
                key={a}
                x={x}
                y={y}
                className="radar-label"
                textAnchor={anchor}
                dominantBaseline={baseline}
              >
                {ANCHOR_LABEL[a]}
              </text>
            );
          })}
        </svg>

        <div className="weekly-divider" />

        <div className="overview">
          <p className="overview-title">Overview</p>
          <div className="overview-stats">
            <p>
              <span className="ov-key">Strongest: </span>
              <span className="ov-val">{strongest}</span>
            </p>
            <p>
              <span className="ov-key">Weakest: </span>
              <span className="ov-val">{weakest}</span>
            </p>
            <p>
              <span className="ov-key">Pattern: </span>
              <span className="ov-val">{pattern}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
