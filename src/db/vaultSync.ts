import { Goal } from "../types";
import { getDb } from "./index";
import { todayDate } from "./helpers";
import { getGoalsForDay, createGoal, deleteGoal, updateGoalStatus } from "./goals";
import {
  readTracker,
  writeTracker,
  parseTrackerBlock,
  serializeBlock,
  spliceBlock,
  VaultGoal,
} from "../vault";

// vault -> SQLite. The vault wins on load: today's goals are rebuilt from the
// fenced block. Status lives in the block too (checkbox + done stamp), so
// nothing is lost by wiping and recreating. Returns false if there's no block
// (in which case the DB is left untouched).
export async function loadVaultIntoDay(dayId: string, date: string): Promise<boolean> {
  let text: string;
  try {
    text = await readTracker();
  } catch {
    return false; // vault not reachable (e.g. path wrong) -> don't clobber DB
  }

  const vaultGoals = parseTrackerBlock(text);
  if (!vaultGoals) return false; // markers missing -> leave the DB as-is

  const existing = await getGoalsForDay(dayId);
  for (const g of existing) await deleteGoal(g.id);

  let didReset = false;
  for (const vg of vaultGoals) {
    // A @repeat goal re-arms each morning: if it was completed on an earlier
    // date, it's not complete today.
    const staleRepeat = vg.repeating && vg.complete && vg.doneDate !== date;
    if (staleRepeat) didReset = true;
    const complete = vg.complete && !staleRepeat;

    const g = await createGoal(
      dayId,
      vg.title,
      vg.anchorType,
      vg.priority,
      "user",
      vg.repeating,
    );
    if (complete) await updateGoalStatus(g.id, "complete");
  }

  // If we auto-reset any @repeat goals, write the corrected (unchecked) block
  // back so the file reflects the new day.
  if (didReset) await flushDayToVault(dayId, date);
  return true;
}

function toVaultGoal(g: Goal, date: string): VaultGoal {
  const complete = g.status === "complete";
  const doneDate = complete ? (g.completedAt ? g.completedAt.slice(0, 10) : date) : null;
  return {
    title: g.title,
    priority: g.priority,
    anchorType: g.anchorType,
    repeating: g.repeating,
    complete,
    doneDate,
  };
}

// SQLite -> vault. Regenerates the fenced block from today's active goals and
// splices it back in, leaving the rest of the tracker untouched.
export async function flushDayToVault(dayId: string, date: string): Promise<void> {
  // Guard against a stale app (left running on a past date) overwriting the
  // block: only the current day may write. If this day isn't today, skip and
  // let the rollover reload rebuild from the vault instead of clobbering it.
  const db = await getDb();
  const rows = await db.select<{ date: string }[]>(
    "SELECT date FROM days WHERE id = $1",
    [dayId],
  );
  if (rows[0]?.date !== todayDate()) return;

  const all = await getGoalsForDay(dayId);
  const active = all.filter((g) => g.status !== "dropped");
  const body = serializeBlock(active.map((g) => toVaultGoal(g, date)));

  let text: string;
  try {
    text = await readTracker();
  } catch {
    return;
  }
  const next = spliceBlock(text, body);
  if (next !== text) await writeTracker(next);
}

// Debounced flush: rapid toggles (e.g. checking several goals) collapse into a
// single file write, and the write stays off the interaction path.
let flushTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleFlush(dayId: string, date: string): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushDayToVault(dayId, date).catch(() => {});
  }, 400);
}
