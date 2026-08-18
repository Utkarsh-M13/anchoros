import { getDb } from "./index";
import {
  AnchorStatus,
  AnchorType,
  ANCHOR_TYPES,
  STATUS_MULTIPLIER,
} from "../types";
import { addDays } from "./helpers";

// Deterministic. The LLM never computes these; it only interprets them.
// dailyAnchorScore = intensity * statusMultiplier * 10.
// 'empty' and 'drifted' both multiply to 0, so an un-checked-in anchor scores
// as drifted WITHOUT us ever rewriting its stored 'empty' status.
export function dailyAnchorScore(intensity: number, status: AnchorStatus): number {
  return intensity * STATUS_MULTIPLIER[status] * 10;
}

// Average score per anchor over the 7 calendar days ending on endDate.
// Denominator is a fixed 7: a day with no log (app not opened) counts as 0,
// same as an empty/drifted anchor. Missing days shouldn't inflate the average.
export async function getWeeklyAnchorScores(
  endDate: string,
): Promise<Record<AnchorType, number>> {
  const db = await getDb();
  const startDate = addDays(endDate, -6);

  const rows = await db.select<
    { anchor_type: AnchorType; status: AnchorStatus; intensity: number }[]
  >(
    `SELECT al.anchor_type, al.status, al.intensity
       FROM anchor_logs al
       JOIN days d ON d.id = al.day_id
      WHERE d.date BETWEEN $1 AND $2`,
    [startDate, endDate],
  );

  const totals: Record<AnchorType, number> = Object.fromEntries(
    ANCHOR_TYPES.map((a) => [a, 0]),
  ) as Record<AnchorType, number>;

  for (const r of rows) {
    totals[r.anchor_type] += dailyAnchorScore(r.intensity, r.status);
  }

  const result = {} as Record<AnchorType, number>;
  for (const a of ANCHOR_TYPES) {
    result[a] = totals[a] / 7;
  }
  return result;
}
