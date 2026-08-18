-- AnchorOS schema. Source of truth is this file.
-- Applied by migrate.ts. Idempotent: every table uses IF NOT EXISTS.
--
-- Design rule that shows up here: an anchor's `status` can be 'empty'.
-- During the day 'empty' means "not checked in yet". After the day ends,
-- scoring TREATS 'empty' as 'drifted' (multiplier 0), but we never rewrite
-- the row, so we can always tell "never checked in" from "explicitly drifted".
-- The DB stores truth; the scoring layer interprets it.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS days (
  id                  TEXT PRIMARY KEY,
  date                TEXT NOT NULL UNIQUE,            -- 'YYYY-MM-DD', one row per day
  state               TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (state IN ('unknown','stable','drifting','recovery','locked_in')),
  minimum_viable_day  TEXT,
  ai_daily_summary    TEXT,
  finalized           INTEGER NOT NULL DEFAULT 0,      -- 0/1, set when the day is closed out
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anchor_logs (
  id           TEXT PRIMARY KEY,
  day_id       TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  anchor_type  TEXT NOT NULL
                 CHECK (anchor_type IN
                   ('physical','technical','career','social','admin','sleep','leisure','joy')),
  status       TEXT NOT NULL DEFAULT 'empty'
                 CHECK (status IN ('complete','partial','intentional_skip','drifted','empty')),
  intensity    INTEGER NOT NULL,                       -- how demanding, roughly 1-10
  note         TEXT,
  updated_at   TEXT NOT NULL,
  UNIQUE (day_id, anchor_type)                         -- exactly one log per anchor per day
);

CREATE TABLE IF NOT EXISTS goals (
  id           TEXT PRIMARY KEY,
  day_id       TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  anchor_type  TEXT
                 CHECK (anchor_type IS NULL OR anchor_type IN
                   ('physical','technical','career','social','admin','sleep','leisure','joy')),
  priority     TEXT NOT NULL DEFAULT 'secondary'
                 CHECK (priority IN ('primary','secondary','optional')),
  status       TEXT NOT NULL DEFAULT 'not_started'
                 CHECK (status IN ('not_started','complete','partial','dropped')),
  created_by   TEXT NOT NULL DEFAULT 'user'
                 CHECK (created_by IN ('user','ai')),
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  day_id      TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- The LLM proposes replans here; it never mutates days/anchor_logs/goals directly.
-- changes_json holds the proposed diff; `applied` flips to 1 only when the user accepts.
CREATE TABLE IF NOT EXISTS replan_events (
  id            TEXT PRIMARY KEY,
  day_id        TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  user_message  TEXT NOT NULL,
  ai_response   TEXT,
  changes_json  TEXT,
  applied       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anchor_logs_day ON anchor_logs(day_id);
CREATE INDEX IF NOT EXISTS idx_goals_day       ON goals(day_id);
CREATE INDEX IF NOT EXISTS idx_notes_day       ON notes(day_id);
CREATE INDEX IF NOT EXISTS idx_replan_day      ON replan_events(day_id);
