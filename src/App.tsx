import { useCallback, useEffect, useState } from "react";
import { migrate } from "./db/migrate";
import { getOrCreateDay, updateAnchorStatus } from "./db/days";
import { getAnchorMatrix, AnchorMatrix as MatrixData } from "./db/matrix";
import { todayDate } from "./db/helpers";
import { AnchorStatus, AnchorType } from "./types";
import { Header } from "./components/Header";
import { AnchorMatrix } from "./components/AnchorMatrix";
import { nextStatus } from "./ui";
import "./App.css";

const MATRIX_DAYS = 3;

function App() {
  const today = todayDate();
  const [dayId, setDayId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setMatrix(await getAnchorMatrix(today, MATRIX_DAYS));
  }, [today]);

  useEffect(() => {
    (async () => {
      try {
        await migrate();
        const day = await getOrCreateDay(today);
        setDayId(day.id);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [today, refresh]);

  const cycleToday = async (anchor: AnchorType, current: AnchorStatus) => {
    if (!dayId) return;
    await updateAnchorStatus(dayId, anchor, nextStatus(current));
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
          <section className="card stub">
            <h2>Weekly Reflection &amp; Statistics</h2>
            <p className="muted">Radar chart, next.</p>
          </section>
        </div>

        {/* Right column: Today's Goals (full height, includes AI section) */}
        <div className="col">
          <section className="card stub goals-card">
            <div className="goals-head">
              <h2>Today&rsquo;s Goals</h2>
              <span className="muted">0/6</span>
            </div>
            <p className="muted">
              Goals (Primary / Secondary / Optional), Minimum Viable Day, and AI Replan, next.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
