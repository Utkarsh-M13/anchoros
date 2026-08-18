import { useCallback, useEffect, useState } from "react";
import { migrate } from "./db/migrate";
import { getOrCreateDay, updateAnchorStatus } from "./db/days";
import { ensureDemoGoals } from "./db/goals";
import { getAnchorMatrix, AnchorMatrix as MatrixData } from "./db/matrix";
import { getWeeklyAnchorScores } from "./db/scoring";
import { todayDate } from "./db/helpers";
import { AnchorStatus, AnchorType, Day } from "./types";
import { Header } from "./components/Header";
import { AnchorMatrix } from "./components/AnchorMatrix";
import { WeeklyRadar } from "./components/WeeklyRadar";
import { TodaysGoals } from "./components/TodaysGoals";
import { nextStatus } from "./ui";
import "./App.css";

const MATRIX_DAYS = 3;

function App() {
  const today = todayDate();
  const [day, setDay] = useState<Day | null>(null);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [scores, setScores] = useState<Record<AnchorType, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setMatrix(await getAnchorMatrix(today, MATRIX_DAYS));
    setScores(await getWeeklyAnchorScores(today));
  }, [today]);

  useEffect(() => {
    (async () => {
      try {
        await migrate();
        const d = await getOrCreateDay(today);
        await ensureDemoGoals(d.id);
        setDay(d);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [today, refresh]);

  const cycleToday = async (anchor: AnchorType, current: AnchorStatus) => {
    if (!day) return;
    await updateAnchorStatus(day.id, anchor, nextStatus(current));
    await refresh();
  };

  if (error) {
    return (
      <div className="app">
        <p className="error">DB error: {error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <div className="grid">
        {/* Left column: anchor matrix, then weekly radar */}
        <div className="col">
          {matrix ? (
            <AnchorMatrix data={matrix} today={today} onCycleToday={cycleToday} />
          ) : (
            <section className="card">
              <p className="muted">Loading anchors...</p>
            </section>
          )}
          <WeeklyRadar scores={scores} />
        </div>

        {/* Right column: Today's Goals (full height, includes AI Replan) */}
        <div className="col">
          {day ? (
            <TodaysGoals dayId={day.id} />
          ) : (
            <section className="card">
              <p className="muted">Loading goals...</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
