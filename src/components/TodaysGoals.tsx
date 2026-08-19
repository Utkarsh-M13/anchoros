import { useCallback, useEffect, useState } from "react";
import { Goal, GoalPriority } from "../types";
import {
  createGoal,
  deleteGoal,
  getGoalsForDay,
  updateGoal,
  updateGoalStatus,
} from "../db/goals";
import { getAnchorLogsForDay } from "../db/days";
import { getWeeklyAnchorScores } from "../db/scoring";
import { scheduleFlush, loadVaultIntoDay } from "../db/vaultSync";
import { todayDate } from "../db/helpers";
import { aiReplan, ReplanResult } from "../ai";
import { StatusIcon } from "./StatusIcon";
import { listen } from "@tauri-apps/api/event";

const MAX_GOALS = 6;
const PRIORITY_RANK: Record<GoalPriority, number> = {
  primary: 0,
  secondary: 1,
  optional: 2,
};

// Plan overrides the Figma label: "Optional", not "Other".
const SECTIONS: { key: GoalPriority; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "optional", label: "Optional" },
];

export function TodaysGoals({ dayId }: { dayId: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [aiMsg, setAiMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [overview, setOverview] = useState<string | null>(null);
  // Goals snapshot from just before the last replan, so Revert can undo it.
  const [snapshot, setSnapshot] = useState<Goal[] | null>(null);

  const refresh = useCallback(async () => {
    setGoals(await getGoalsForDay(dayId));
  }, [dayId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live sync: when the tracker changes on disk from OUTSIDE the app (hand
  // edits, /done), reload today's goals from the vault. Self-writes are
  // suppressed in Rust, so this only fires for external changes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listen("tracker-changed", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        await loadVaultIntoDay(dayId, todayDate());
        setSnapshot(null); // external edit invalidates the pre-replan baseline
        setOverview(null);
        await refresh();
      }, 250);
    });
    return () => {
      unlisten.then((f) => f());
      if (timer) clearTimeout(timer);
    };
  }, [dayId, refresh]);

  // Dropped goals stay in the DB (so Revert can restore them) but are hidden.
  const active = goals.filter((g) => g.status !== "dropped");
  const total = active.length;
  const done = active.filter((g) => g.status === "complete").length;

  const toggle = async (g: Goal) => {
    await updateGoalStatus(g.id, g.status === "complete" ? "not_started" : "complete");
    await refresh();
    scheduleFlush(dayId, todayDate());
  };

  const applyChanges = async (result: ReplanResult, current: Goal[]) => {
    for (const c of result.proposedChanges) {
      if (c.action === "add") {
        await createGoal(dayId, c.newTitle || c.goalTitle, null, c.priority || "secondary");
        continue;
      }
      const match = current.find((g) => g.title === c.goalTitle);
      if (!match) continue;
      if (c.action === "drop") {
        await updateGoalStatus(match.id, "dropped");
      } else if (c.action === "modify") {
        await updateGoal(match.id, { title: c.newTitle, priority: c.priority });
      }
    }
  };

  // Keep at most 6 active goals. Drop lowest-priority, then oldest, so a new
  // primary beats an old optional. Dropped (not deleted) so Revert restores it.
  const enforceCap = async () => {
    const all = await getGoalsForDay(dayId);
    const activeGoals = all.filter((g) => g.status !== "dropped");
    if (activeGoals.length <= MAX_GOALS) return;
    const ordered = [...activeGoals].sort((a, b) => {
      if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      }
      return b.createdAt.localeCompare(a.createdAt); // newer first within a priority
    });
    for (const g of ordered.slice(MAX_GOALS)) {
      await updateGoalStatus(g.id, "dropped");
    }
  };

  const replan = async () => {
    const message = aiMsg.trim();
    if (!message || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const date = todayDate();
      const anchors = await getAnchorLogsForDay(dayId);
      const scores = await getWeeklyAnchorScores(date);
      const result = await aiReplan({
        date,
        message,
        anchors: anchors.map((a) => ({
          anchorType: a.anchorType,
          status: a.status,
          intensity: a.intensity,
        })),
        goals: active.map((g) => ({
          title: g.title,
          priority: g.priority,
          status: g.status,
        })),
        weeklyScores: scores,
      });
      // Snapshot the baseline once, so Revert undoes all replans back to it.
      if (!snapshot) setSnapshot(goals);
      await applyChanges(result, goals);
      await enforceCap();
      setOverview(result.overview);
      setAiMsg("");
      await refresh();
      scheduleFlush(dayId, date);
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  // Read-only: ask the AI to assess the day and show its overview, without
  // applying (or proposing) any changes. Message is optional here.
  const summarize = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const date = todayDate();
      const anchors = await getAnchorLogsForDay(dayId);
      const scores = await getWeeklyAnchorScores(date);
      const result = await aiReplan({
        date,
        message: aiMsg.trim(),
        summarizeOnly: true,
        anchors: anchors.map((a) => ({
          anchorType: a.anchorType,
          status: a.status,
          intensity: a.intensity,
        })),
        goals: active.map((g) => ({
          title: g.title,
          priority: g.priority,
          status: g.status,
        })),
        weeklyScores: scores,
      });
      setOverview(result.overview);
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  // Restore goals to the snapshot taken before the last replan.
  const revert = async () => {
    if (!snapshot || aiLoading) return;
    const current = await getGoalsForDay(dayId);
    const snapIds = new Set(snapshot.map((g) => g.id));
    // Delete goals the replan added (present now, not in the snapshot).
    for (const g of current) {
      if (!snapIds.has(g.id)) await deleteGoal(g.id);
    }
    // Restore modified / dropped goals to their snapshot values.
    for (const g of snapshot) {
      await updateGoal(g.id, { title: g.title, priority: g.priority });
      await updateGoalStatus(g.id, g.status);
    }
    setSnapshot(null);
    setOverview(null);
    await refresh();
    scheduleFlush(dayId, todayDate());
  };

  return (
    <section className="card goals-card">
      <div className="goals-head">
        <h2>Today&rsquo;s Goals</h2>
        <span className="goals-count">
          {done}/{total}
        </span>
      </div>

      <div className="goals-list">
        {SECTIONS.map(({ key, label }) => {
          const items = active.filter((g) => g.priority === key);
          return (
            <div key={key} className="goal-section">
              <p className="goal-section-label">{label}</p>
              {items.map((g) => {
                const complete = g.status === "complete";
                return (
                  <button
                    key={g.id}
                    className="goal-row"
                    onClick={() => toggle(g)}
                    title={g.title}
                  >
                    <span className={`goal-check ${complete ? "set" : ""}`}>
                      {complete && <StatusIcon status="complete" size={11} />}
                    </span>
                    <span className={`goal-title ${complete ? "done" : ""}`}>
                      {g.title}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="goals-divider" />

      <div className="replan">
        <p className="replan-label">AI Overview and Modifications</p>
        <p className="replan-overview">
          {overview ??
            "Tell the AI what changed and it will replan today. Revert undoes the last one."}
        </p>

        <textarea
          className="replan-input"
          placeholder="What changed today?"
          value={aiMsg}
          onChange={(e) => setAiMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              replan();
            }
          }}
          disabled={aiLoading}
        />
        <div className="replan-actions">
          <button className="btn-revert" onClick={revert} disabled={!snapshot || aiLoading}>
            Revert
          </button>
          <button className="btn-summarize" onClick={summarize} disabled={aiLoading}>
            Summarize
          </button>
          <button
            className="btn-replan"
            onClick={replan}
            disabled={aiLoading || !aiMsg.trim()}
          >
            {aiLoading ? "Thinking..." : "Replan"}
          </button>
        </div>
        {aiError && <p className="replan-error">{aiError}</p>}
      </div>
    </section>
  );
}
