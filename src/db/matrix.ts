import { getDb } from "./index";
import { AnchorType, AnchorStatus, ANCHOR_TYPES } from "../types";
import { addDays } from "./helpers";

// One cell of the anchor matrix. null = no log for that anchor on that day
// (the app wasn't opened), which the UI renders as empty / not-started.
export type MatrixCell = { status: AnchorStatus; intensity: number } | null;

export type AnchorMatrix = {
  dates: string[]; // oldest -> newest, length numDays, includes endDate
  cells: Record<AnchorType, Record<string, MatrixCell>>;
};

// Grid of the last `numDays` days ending on endDate: 8 anchor rows x N day columns.
export async function getAnchorMatrix(
  endDate: string,
  numDays: number,
): Promise<AnchorMatrix> {
  const db = await getDb();
  const startDate = addDays(endDate, -(numDays - 1));

  const rows = await db.select<
    { date: string; anchor_type: AnchorType; status: AnchorStatus; intensity: number }[]
  >(
    `SELECT d.date, al.anchor_type, al.status, al.intensity
       FROM anchor_logs al
       JOIN days d ON d.id = al.day_id
      WHERE d.date BETWEEN $1 AND $2`,
    [startDate, endDate],
  );

  const dates: string[] = [];
  for (let i = 0; i < numDays; i++) dates.push(addDays(startDate, i));

  const cells = {} as Record<AnchorType, Record<string, MatrixCell>>;
  for (const a of ANCHOR_TYPES) {
    cells[a] = {};
    for (const dt of dates) cells[a][dt] = null;
  }
  for (const r of rows) {
    cells[r.anchor_type][r.date] = { status: r.status, intensity: r.intensity };
  }

  return { dates, cells };
}
