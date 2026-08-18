import { AnchorStatus, AnchorType } from "./types";

// "physical" is stored in the DB; the product calls it "Body".
export const ANCHOR_LABEL: Record<AnchorType, string> = {
  physical: "Body",
  technical: "Technical",
  career: "Career",
  social: "Social",
  admin: "Admin",
  sleep: "Sleep",
  leisure: "Leisure",
  joy: "Joy",
};

// Glyphs from the Figma. 'empty' shows no glyph; the cell border alone reads
// as an empty box.
export const STATUS_SYMBOL: Record<AnchorStatus, string> = {
  complete: "✓", // ✓
  partial: "–", // –
  intentional_skip: "⊘", // ⊘
  drifted: "✕", // ✕
  empty: "",
};

export const STATUS_CLASS: Record<AnchorStatus, string> = {
  complete: "s-complete",
  partial: "s-partial",
  intentional_skip: "s-skip",
  drifted: "s-drifted",
  empty: "s-empty",
};

// Click order for cycling today's cell.
const CYCLE: AnchorStatus[] = [
  "empty",
  "complete",
  "partial",
  "intentional_skip",
  "drifted",
];

export const nextStatus = (s: AnchorStatus): AnchorStatus =>
  CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length];

// Column header: "Today" for today, else "Mon 11" style.
export function colLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  const wd = d.toLocaleDateString(undefined, { weekday: "short" });
  return `${wd} ${d.getDate()}`;
}
