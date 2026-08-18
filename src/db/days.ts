import { getDb } from "./index";
import {
  Day,
  AnchorLog,
  AnchorStatus,
  AnchorType,
  ANCHOR_TYPES,
  DEFAULT_INTENSITY,
} from "../types";
import { newId, nowIso } from "./helpers";

// Rows come back snake_case from SQLite; we map to our camelCase types.
type DayRow = {
  id: string;
  date: string;
  state: Day["state"];
  minimum_viable_day: string | null;
  ai_daily_summary: string | null;
  finalized: number; // SQLite has no bool; 0/1
  created_at: string;
  updated_at: string;
};

type AnchorLogRow = {
  id: string;
  day_id: string;
  anchor_type: AnchorType;
  status: AnchorStatus;
  intensity: number;
  note: string | null;
  updated_at: string;
};

const mapDay = (r: DayRow): Day => ({
  id: r.id,
  date: r.date,
  state: r.state,
  minimumViableDay: r.minimum_viable_day,
  aiDailySummary: r.ai_daily_summary,
  finalized: r.finalized === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapAnchorLog = (r: AnchorLogRow): AnchorLog => ({
  id: r.id,
  dayId: r.day_id,
  anchorType: r.anchor_type,
  status: r.status,
  intensity: r.intensity,
  note: r.note,
  updatedAt: r.updated_at,
});

// Core entry point: called when the app opens for a given date.
// Guarantees a day row exists AND that all 8 anchors have a log for it,
// seeded to 'empty' with their default intensity.
export async function getOrCreateDay(date: string): Promise<Day> {
  const db = await getDb();

  let rows = await db.select<DayRow[]>("SELECT * FROM days WHERE date = $1", [date]);

  if (rows.length === 0) {
    const id = newId();
    const ts = nowIso();
    await db.execute(
      `INSERT INTO days (id, date, state, finalized, created_at, updated_at)
       VALUES ($1, $2, 'unknown', 0, $3, $3)`,
      [id, date, ts],
    );
    rows = await db.select<DayRow[]>("SELECT * FROM days WHERE id = $1", [id]);
  }

  const day = mapDay(rows[0]);
  await ensureAnchorLogs(day.id);
  return day;
}

// Creates any missing anchor logs for the day. Idempotent thanks to the
// UNIQUE(day_id, anchor_type) constraint plus this existence check.
async function ensureAnchorLogs(dayId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ anchor_type: AnchorType }[]>(
    "SELECT anchor_type FROM anchor_logs WHERE day_id = $1",
    [dayId],
  );
  const have = new Set(existing.map((r) => r.anchor_type));
  const ts = nowIso();

  for (const anchor of ANCHOR_TYPES) {
    if (have.has(anchor)) continue;
    await db.execute(
      `INSERT INTO anchor_logs (id, day_id, anchor_type, status, intensity, updated_at)
       VALUES ($1, $2, $3, 'empty', $4, $5)`,
      [newId(), dayId, anchor, DEFAULT_INTENSITY[anchor], ts],
    );
  }
}

export async function getAnchorLogsForDay(dayId: string): Promise<AnchorLog[]> {
  const db = await getDb();
  const rows = await db.select<AnchorLogRow[]>(
    "SELECT * FROM anchor_logs WHERE day_id = $1",
    [dayId],
  );
  // Return in canonical anchor order, not insertion order.
  const byType = new Map(rows.map((r) => [r.anchor_type, mapAnchorLog(r)]));
  return ANCHOR_TYPES.map((a) => byType.get(a)).filter((x): x is AnchorLog => !!x);
}

// Updates one anchor's status. intensity/note are optional: when omitted, the
// existing values are kept (we read-merge-write so partial updates are safe).
export async function updateAnchorStatus(
  dayId: string,
  anchorType: AnchorType,
  status: AnchorStatus,
  intensity?: number,
  note?: string | null,
): Promise<void> {
  const db = await getDb();
  const rows = await db.select<AnchorLogRow[]>(
    "SELECT * FROM anchor_logs WHERE day_id = $1 AND anchor_type = $2",
    [dayId, anchorType],
  );
  if (rows.length === 0) {
    throw new Error(`No anchor_log for ${anchorType} on day ${dayId}`);
  }
  const cur = rows[0];
  const nextIntensity = intensity ?? cur.intensity;
  const nextNote = note !== undefined ? note : cur.note;

  await db.execute(
    `UPDATE anchor_logs
       SET status = $1, intensity = $2, note = $3, updated_at = $4
     WHERE day_id = $5 AND anchor_type = $6`,
    [status, nextIntensity, nextNote, nowIso(), dayId, anchorType],
  );
}
