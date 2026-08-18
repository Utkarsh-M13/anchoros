import { useCallback, useEffect, useRef, useState } from "react";
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
import { Settings } from "./components/Settings";
import { getLock, setLock } from "./window";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { nextStatus } from "./ui";
import "./App.css";

const MATRIX_DAYS = 3;

function App() {
  const today = todayDate();
  const [day, setDay] = useState<Day | null>(null);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [scores, setScores] = useState<Record<AnchorType, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    getLock().then(setLocked).catch(() => {});
  }, []);

  // Drag the window from anywhere on the background, except actual controls
  // (buttons, inputs) and the settings dialog.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("button, input, textarea, select, a, .settings-overlay")) {
        return;
      }
      getCurrentWindow().startDragging().catch(() => {});
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  const toggleLock = async () => {
    const next = !locked;
    try {
      await setLock(next);
      setLocked(next);
    } catch {
      /* ignore */
    }
  };

  const refresh = useCallback(async () => {
    setMatrix(await getAnchorMatrix(today, MATRIX_DAYS));
    setScores(await getWeeklyAnchorScores(today));
  }, [today]);

  // Guard against StrictMode's double-invoke in dev (which double-seeded goals).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
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

  // Cycle any day's anchor (today or a backfilled past day). getOrCreateDay
  // creates the day + its 8 anchors on demand if it didn't exist yet.
  const cycle = async (anchor: AnchorType, date: string, current: AnchorStatus) => {
    const d = await getOrCreateDay(date);
    await updateAnchorStatus(d.id, anchor, nextStatus(current));
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
      <Header
        onSettings={() => setSettingsOpen(true)}
        onToggleLock={toggleLock}
        locked={locked}
      />
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      <div className="grid">
        {/* Left column: anchor matrix, then weekly radar */}
        <div className="col">
          {matrix ? (
            <AnchorMatrix data={matrix} today={today} onCycle={cycle} />
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
