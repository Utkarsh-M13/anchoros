export type AnchorType = 
	| "physical"
	| "technical"
	| "leisure"
	| "career"
	| "social"
	| "admin"
	| "sleep"
	| "joy"

export type AnchorStatus =
  | "complete"
  | "partial"
  | "intentional_skip"
  | "drifted"
  | "empty";

export type GoalPriority = "primary" | "secondary" | "optional";

export type GoalStatus = "not_started" | "complete" | "partial" | "dropped";

export type DayState =
  | "unknown"
  | "stable"
  | "drifting"
  | "recovery"
  | "locked_in";

export type Day = {
  id: string;
  date: string;
  state: DayState;
  minimumViableDay: string | null;
  aiDailySummary: string | null;
  finalized: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AnchorLog = {
  id: string;
  dayId: string;
  anchorType: AnchorType;
  status: AnchorStatus;
  intensity: number;
  note: string | null;
  updatedAt: string;
};

export type Goal = {
  id: string;
  dayId: string;
  title: string;
  anchorType: AnchorType | null;
  priority: GoalPriority;
  status: GoalStatus;
  createdBy: "user" | "ai";
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id: string;
  dayId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ReplanEvent = {
  id: string;
  dayId: string;
  userMessage: string;
  aiResponse: string | null;
  changesJson: string | null;
  applied: boolean;
  createdAt: string;
};

// The 8 anchors, in display order. "physical" renders as "Body" in the UI.
export const ANCHOR_TYPES: AnchorType[] = [
  "physical",
  "technical",
  "career",
  "social",
  "admin",
  "sleep",
  "leisure",
  "joy",
];

// Seeded when a day is first created. Rough "how demanding" baseline, 1-10.
export const DEFAULT_INTENSITY: Record<AnchorType, number> = {
  physical: 6,
  technical: 7,
  career: 6,
  social: 4,
  admin: 4,
  sleep: 5,
  leisure: 3,
  joy: 4, // TODO: confirm, plan had no default for joy (it used food:5)
};

// Scoring: dailyAnchorScore = intensity * STATUS_MULTIPLIER[status] * 10.
// 'empty' scores 0 like 'drifted', but stays 'empty' in the DB.
export const STATUS_MULTIPLIER: Record<AnchorStatus, number> = {
  complete: 1.0,
  partial: 0.55,
  intentional_skip: 0.25,
  drifted: 0.0,
  empty: 0.0,
};
