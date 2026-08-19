import schema from "./schema.sql?raw";
import { getDb } from "./index";

// Applies schema.sql. The plugin runs one statement per execute() call, so we
// strip line comments and split on ';'. schema.sql has no ';' inside strings,
// so a plain split is safe here. Idempotent: every statement uses IF NOT EXISTS.
export async function migrate(): Promise<void> {
  const db = await getDb();

  const withoutComments = schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await db.execute(stmt);
  }

  // schema.sql only creates tables IF NOT EXISTS, so columns added later need an
  // explicit, idempotent backfill for DBs that already exist.
  await ensureColumn("goals", "repeating", "INTEGER NOT NULL DEFAULT 0");
}

async function ensureColumn(table: string, column: string, decl: string): Promise<void> {
  const db = await getDb();
  const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}
