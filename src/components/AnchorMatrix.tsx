import { AnchorMatrix as MatrixData } from "../db/matrix";
import { AnchorStatus, AnchorType, ANCHOR_TYPES } from "../types";
import { ANCHOR_LABEL, STATUS_CLASS, colLabel } from "../ui";
import { StatusIcon } from "./StatusIcon";

type Props = {
  data: MatrixData;
  today: string;
  onCycleToday: (anchor: AnchorType, current: AnchorStatus) => void;
};

// 8 anchor rows x N day columns. Past days are read-only history; only today's
// column is clickable. Empty cell = dark glossy box; a set status fills the box
// white with a dark silhouette glyph inside.
export function AnchorMatrix({ data, today, onCycleToday }: Props) {
  return (
    <section className="card matrix-card">
      <table className="matrix">
        <thead>
          <tr>
            <th />
            {data.dates.map((d) => (
              <th key={d} className={d === today ? "col-today" : ""}>
                {colLabel(d, today)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ANCHOR_TYPES.map((anchor) => (
            <tr key={anchor}>
              <th className="row-label">{ANCHOR_LABEL[anchor]}</th>
              {data.dates.map((d) => {
                const cell = data.cells[anchor][d];
                const status: AnchorStatus = cell ? cell.status : "empty";
                const isSet = status !== "empty";
                const isToday = d === today;
                return (
                  <td key={d}>
                    <button
                      className={[
                        "cell",
                        STATUS_CLASS[status],
                        isSet ? "set" : "",
                        isToday ? "editable" : "readonly",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={isToday ? () => onCycleToday(anchor, status) : undefined}
                      disabled={!isToday}
                      title={`${ANCHOR_LABEL[anchor]}: ${status}`}
                    >
                      {isSet && <StatusIcon status={status} />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
