import { useCallback, useEffect, useState } from "react";
import { Goal, GoalPriority } from "../types";
import { getGoalsForDay, updateGoalStatus } from "../db/goals";
import { StatusIcon } from "./StatusIcon";

// Plan overrides the Figma label: "Optional", not "Other".
const SECTIONS: { key: GoalPriority; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "optional", label: "Optional" },
];

export function TodaysGoals({ dayId }: { dayId: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);

  const refresh = useCallback(async () => {
    setGoals(await getGoalsForDay(dayId));
  }, [dayId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const total = goals.length;
  const done = goals.filter((g) => g.status === "complete").length;

  const toggle = async (g: Goal) => {
    await updateGoalStatus(g.id, g.status === "complete" ? "not_started" : "complete");
    await refresh();
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
          const items = goals.filter((g) => g.priority === key);
          return (
            <div key={key} className="goal-section">
              <p className="goal-section-label">{label}</p>
              {items.map((g) => {
                const complete = g.status === "complete";
                return (
                  <button key={g.id} className="goal-row" onClick={() => toggle(g)}>
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
          Focus on your primary goals to keep today alive.
        </p>
        <textarea className="replan-input" placeholder="Modify Goals" disabled />
      </div>
    </section>
  );
}
