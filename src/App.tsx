import { useEffect, useState } from "react";
import { migrate } from "./db/migrate";
import { getOrCreateDay, getAnchorLogsForDay } from "./db/days";
import { getWeeklyAnchorScores } from "./db/scoring";
import { AnchorLog, AnchorType } from "./types";
import { todayDate } from "./db/helpers";

// Smoke test for the data layer, NOT the real dashboard. Runs the migration,
// seeds today, and renders the 8 anchors + weekly scores so we can confirm
// end-to-end (schema -> queries -> UI) works before building the real UI.
function App() {
  const [status, setStatus] = useState("starting...");
  const [anchors, setAnchors] = useState<AnchorLog[]>([]);
  const [scores, setScores] = useState<Record<AnchorType, number> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await migrate();
        const date = todayDate();
        const day = await getOrCreateDay(date);
        setAnchors(await getAnchorLogsForDay(day.id));
        setScores(await getWeeklyAnchorScores(date));
        setStatus(`DB ready. Day ${date} seeded.`);
      } catch (e) {
        setStatus("DB error: " + String(e));
      }
    })();
  }, []);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        background: "#0a0a0a",
        color: "#eaeaea",
        minHeight: "100vh",
        padding: "32px",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 28 }}>AnchorOS</h1>
      <p style={{ opacity: 0.6, marginTop: 4 }}>Fall to your systems</p>
      <p style={{ marginTop: 20, opacity: 0.85 }}>{status}</p>

      <ul style={{ marginTop: 16, lineHeight: 1.9, listStyle: "none", padding: 0 }}>
        {anchors.map((a) => (
          <li key={a.id}>
            <span style={{ display: "inline-block", width: 90, textTransform: "capitalize" }}>
              {a.anchorType}
            </span>
            <span style={{ opacity: 0.7 }}>
              {a.status} (intensity {a.intensity})
              {scores ? ` — wk ${scores[a.anchorType].toFixed(1)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
