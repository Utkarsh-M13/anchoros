import { invoke } from "@tauri-apps/api/core";
import { AnchorType, GoalPriority } from "./types";

// Thin wrappers over the Rust commands. Rust only does file read/write; all
// parsing and splicing of the fenced "TODAY (AnchorOS)" block lives here.
export const readTracker = () => invoke<string>("read_tracker");
export const writeTracker = (content: string) =>
  invoke<void>("write_tracker", { content });

const START = "<!-- anchoros:start -->";
const END = "<!-- anchoros:end -->";

// One parsed task from the fenced block.
export type VaultGoal = {
  title: string;
  priority: GoalPriority;
  anchorType: AnchorType | null;
  repeating: boolean;
  complete: boolean;
  doneDate: string | null; // 'YYYY-MM-DD' from the "(done ...)" stamp
};

const ANCHORS: AnchorType[] = [
  "physical",
  "technical",
  "career",
  "social",
  "admin",
  "sleep",
  "leisure",
  "joy",
];
// "Body" is the product label for the physical anchor, so accept it as a tag.
const TAG_ALIAS: Record<string, AnchorType> = { body: "physical" };

function tagToAnchor(tag: string): AnchorType | null {
  const t = tag.toLowerCase();
  if ((ANCHORS as string[]).includes(t)) return t as AnchorType;
  return TAG_ALIAS[t] ?? null;
}

// Fallback when a line carries no explicit #anchor tag. First match wins.
const KEYWORDS: [RegExp, AnchorType][] = [
  [/\b(run|gym|lift|legs?|workout|marathon|walk|cardio|eat|meal|food)\b/i, "physical"],
  [/\b(leetcode|code|coding|project|build|debug|system design|ship|deploy)\b/i, "technical"],
  [/\b(apply|application|internship|job|resume|linkedin|sponsorship|recruit|interview)\b/i, "career"],
  [/\b(lsat|finance|pack|email|charter|doc|paperwork|eb-?5|visa|admin|bank|file)\b/i, "admin"],
  [/\b(friends?|hangout|call|family|brother|social)\b/i, "social"],
  [/\b(sleep|bed|rest|nap)\b/i, "sleep"],
  [/\b(read|leisure|game|relax|watch|movie)\b/i, "leisure"],
  [/\b(joy|fun|music|hobby|paint|draw)\b/i, "joy"],
];

function inferAnchor(title: string): AnchorType | null {
  for (const [re, a] of KEYWORDS) if (re.test(title)) return a;
  return null;
}

const PRIORITY_HEAD: Record<string, GoalPriority> = {
  primary: "primary",
  secondary: "secondary",
  optional: "optional",
};

// Parse the fenced block into goals. Returns null if the markers aren't present
// (so callers can choose to leave the DB untouched rather than wipe it).
export function parseTrackerBlock(text: string): VaultGoal[] | null {
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  if (s === -1 || e === -1 || e < s) return null;

  // Strip whole HTML-comment spans first (the FORMAT legend is multi-line and
  // contains an example "- [ ] ..." line that must NOT be parsed as a goal).
  const inner = text.slice(s + START.length, e).replace(/<!--[\s\S]*?-->/g, "");
  const goals: VaultGoal[] = [];
  let priority: GoalPriority = "secondary";

  for (const raw of inner.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const head = line.match(/^#{2,3}\s+(Primary|Secondary|Optional)\b/i);
    if (head) {
      priority = PRIORITY_HEAD[head[1].toLowerCase()];
      continue;
    }

    const m = line.match(/^-\s*\[( |x|X)\]\s*(.*)$/);
    if (!m) continue;

    const complete = m[1].toLowerCase() === "x";
    let body = m[2];

    // "(done YYYY-MM-DD)" stamp at the end (same convention as /done).
    let doneDate: string | null = null;
    const done = body.match(/\(done\s+(\d{4}-\d{2}-\d{2})\)\s*$/i);
    if (done) {
      doneDate = done[1];
      body = body.slice(0, done.index).trim();
    }

    // @repeat marker.
    let repeating = false;
    if (/(^|\s)@repeat\b/i.test(body)) {
      repeating = true;
      body = body.replace(/(^|\s)@repeat\b/gi, " ").trim();
    }

    // #anchor tag(s). Known tags are consumed; unknown #hashtags stay in title.
    let anchorType: AnchorType | null = null;
    body = body
      .replace(/(^|\s)#([a-z]+)\b/gi, (full, _pre, tag) => {
        const a = tagToAnchor(tag);
        if (a && !anchorType) {
          anchorType = a;
          return " ";
        }
        return full;
      })
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!anchorType) anchorType = inferAnchor(body);
    goals.push({ title: body, priority, anchorType, repeating, complete, doneDate });
  }

  return goals;
}

const LEGEND = `<!-- FORMAT (keep it exact so the app can round-trip):
       ### Primary | Secondary | Optional   -> the app's three tiers
       - [ ] title #anchor @repeat
         #anchor (optional) = one of: physical technical career social admin sleep leisure joy
         @repeat = daily goal, auto-resets each morning. No @repeat = one-off for today only.
       Checking an item appends "(done YYYY-MM-DD)", same as /done. Unchecking strips it. -->`;

const ORDER: { key: GoalPriority; head: string }[] = [
  { key: "primary", head: "### Primary" },
  { key: "secondary", head: "### Secondary" },
  { key: "optional", head: "### Optional" },
];

function goalLine(g: VaultGoal): string {
  const box = g.complete ? "x" : " ";
  let s = `- [${box}] ${g.title}`;
  if (g.anchorType) s += ` #${g.anchorType}`;
  if (g.repeating) s += ` @repeat`;
  if (g.complete && g.doneDate) s += ` (done ${g.doneDate})`;
  return s;
}

// Render the block body (legend + priority sections). Empty sections are
// omitted so the file stays clean.
export function serializeBlock(goals: VaultGoal[]): string {
  const lines: string[] = [LEGEND];
  for (const { key, head } of ORDER) {
    const items = goals.filter((g) => g.priority === key);
    if (items.length === 0) continue;
    lines.push(head);
    for (const g of items) lines.push(goalLine(g));
  }
  return lines.join("\n");
}

// Replace everything between the markers, leaving the rest of the file exactly
// as-is. If the markers are missing, the file is returned untouched.
export function spliceBlock(text: string, blockBody: string): string {
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  if (s === -1 || e === -1 || e < s) return text;
  const before = text.slice(0, s + START.length);
  const after = text.slice(e);
  return `${before}\n${blockBody}\n${after}`;
}
