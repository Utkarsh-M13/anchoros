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
