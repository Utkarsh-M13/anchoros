import { AnchorMatrix as MatrixData } from "../db/matrix";
import { AnchorStatus, AnchorType, ANCHOR_TYPES } from "../types";
import { ANCHOR_LABEL, STATUS_CLASS, colLabel } from "../ui";
import { StatusIcon } from "./StatusIcon";

type Props = {
  data: MatrixData;
  today: string;
  onCycle: (anchor: AnchorType, date: string, current: AnchorStatus) => void;
};

// 8 anchor rows x N day columns. Every column is editable (click to cycle), so
// you can backfill the last couple of days as well as today.
export function AnchorMatrix({ data, today, onCycle }: Props) {
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
                return (
                  <td key={d}>
                    <button
                      className={["cell", STATUS_CLASS[status], isSet ? "set" : "", "editable"]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => onCycle(anchor, d, status)}
                      title={`${ANCHOR_LABEL[anchor]} (${colLabel(d, today)}): ${status}`}
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
