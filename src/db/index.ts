import Databse from "better-sqlite"
import path from "path";

export const db = new Database(path.join(process.cwd(), "anchoros.db"));

db.pragma("foreign_keys = ON");
