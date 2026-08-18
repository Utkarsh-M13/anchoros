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
}
