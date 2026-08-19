import { invoke } from "@tauri-apps/api/core";
import { AnchorType, GoalPriority } from "./types";

export type ProposedChange = {
  action: "add" | "modify" | "drop";
  goalTitle: string;
  newTitle?: string;
  priority?: GoalPriority;
  reason: string;
};

export type ReplanResult = {
  overview: string;
  minimumViableDay: string;
  proposedChanges: ProposedChange[];
};

export type ReplanContext = {
  date: string;
  message: string;
  anchors: { anchorType: AnchorType; status: string; intensity: number }[];
  goals: { title: string; priority: string; status: string }[];
  weeklyScores: Record<string, number>;
  // When true, the AI only assesses the day and proposes no changes.
  summarizeOnly?: boolean;
};

// Calls the Rust `ai_replan` command, which holds the API key and calls Claude.
// The AI only proposes; nothing is written to the DB here.
export async function aiReplan(context: ReplanContext): Promise<ReplanResult> {
  return invoke<ReplanResult>("ai_replan", { context });
}
