import { getDb } from "./index";
import { Goal, GoalPriority, GoalStatus, AnchorType } from "../types";
import { newId, nowIso } from "./helpers";

type GoalRow = {
  id: string;
  day_id: string;
  title: string;
  anchor_type: AnchorType | null;
  priority: GoalPriority;
  status: GoalStatus;
  created_by: "user" | "ai";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const mapGoal = (r: GoalRow): Goal => ({
  id: r.id,
  dayId: r.day_id,
  title: r.title,
  anchorType: r.anchor_type,
  priority: r.priority,
  status: r.status,
  createdBy: r.created_by,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function createGoal(
  dayId: string,
  title: string,
  anchorType: AnchorType | null = null,
  priority: GoalPriority = "secondary",
  createdBy: "user" | "ai" = "user",
): Promise<Goal> {
  const db = await getDb();
  const id = newId();
  const ts = nowIso();
  await db.execute(
    `INSERT INTO goals
       (id, day_id, title, anchor_type, priority, status, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'not_started', $6, $7, $7)`,
    [id, dayId, title, anchorType, priority, createdBy, ts],
  );
  const rows = await db.select<GoalRow[]>("SELECT * FROM goals WHERE id = $1", [id]);
  return mapGoal(rows[0]);
}

export async function getGoalsForDay(dayId: string): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.select<GoalRow[]>(
    "SELECT * FROM goals WHERE day_id = $1 ORDER BY created_at ASC",
    [dayId],
  );
  return rows.map(mapGoal);
}

// Sets completed_at when moving to 'complete', clears it otherwise.
export async function updateGoalStatus(
  goalId: string,
  status: GoalStatus,
): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  const completedAt = status === "complete" ? ts : null;
  await db.execute(
    "UPDATE goals SET status = $1, completed_at = $2, updated_at = $3 WHERE id = $4",
    [status, completedAt, ts, goalId],
  );
}

// Demo goals matching the Figma, seeded only when a day has none yet.
// Temporary: once the AI Replan box is wired, goals come from there instead.
const DEMO_GOALS: { title: string; priority: GoalPriority }[] = [
  { title: "Go to the gym", priority: "primary" },
  { title: "2 hours of Leetcode", priority: "primary" },
  { title: "LSAT logical reasoning", priority: "secondary" },
  { title: "Apply to internships", priority: "secondary" },
  { title: "Hangout with friends", priority: "optional" },
  { title: "Clean room", priority: "optional" },
];

export async function ensureDemoGoals(dayId: string): Promise<void> {
  const existing = await getGoalsForDay(dayId);
  if (existing.length > 0) return;
  for (const g of DEMO_GOALS) {
    await createGoal(dayId, g.title, null, g.priority);
  }
}
