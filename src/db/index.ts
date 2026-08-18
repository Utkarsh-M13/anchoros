import Database from "@tauri-apps/plugin-sql";

// tauri-plugin-sql owns the file (stored under the OS app-data dir).
// One shared connection, loaded lazily on first use.
const DB_URL = "sqlite:anchoros.db";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}
