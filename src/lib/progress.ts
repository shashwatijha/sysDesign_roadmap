import { all, one, run } from "./db";

// ---------- dates (local time, YYYY-MM-DD) ----------
export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseDay(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(k: string, n: number): string {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
/** ISO-ish week id (Monday start) used to cap streak freezes at one per week */
export function weekKey(k: string): string {
  const d = parseDay(k);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return dayKey(d);
}
const nowIso = () => new Date().toISOString();

// ---------- activity ----------
export type ActivityKind = "problem_done" | "step_saved" | "drill" | "read";

export function logActivity(kind: ActivityKind, ref?: string) {
  run("INSERT INTO activity (day, kind, ref, at) VALUES (?, ?, ?, ?)", [dayKey(), kind, ref ?? null, nowIso()]);
}

/** counts per day for the heatmap; weight problem completions heavier */
export function activityByDay(): Map<string, { problems: number; total: number }> {
  const rows = all<{ day: string; kind: string; n: number }>(
    "SELECT day, kind, COUNT(*) AS n FROM activity GROUP BY day, kind",
  );
  const m = new Map<string, { problems: number; total: number }>();
  for (const r of rows) {
    const e = m.get(r.day) ?? { problems: 0, total: 0 };
    if (r.kind === "problem_done") e.problems += r.n;
    e.total += r.kind === "problem_done" ? r.n * 4 : r.kind === "step_saved" ? 0 : r.n;
    m.set(r.day, e);
  }
  return m;
}

// ---------- streak ----------
export interface StreakInfo {
  current: number;
  best: number;
  todayDone: boolean;
  frozenDays: string[];
  freezeAvailableThisWeek: boolean;
}

/**
 * A day counts when at least one problem was completed that day.
 * One missed day per Mon-Sun week is forgiven (a "freeze"), applied
 * automatically. Today never breaks the streak until it's over.
 */
export function computeStreak(today = dayKey()): StreakInfo {
  const done = new Set(
    all<{ day: string }>("SELECT DISTINCT day FROM activity WHERE kind = 'problem_done'").map((r) => r.day),
  );
  if (done.size === 0) {
    return { current: 0, best: 0, todayDone: false, frozenDays: [], freezeAvailableThisWeek: true };
  }
  const sorted = [...done].sort();
  const first = sorted[0];

  // Walk forward from the first active day to today, tracking runs.
  const frozen: string[] = [];
  const weeksUsed = new Set<string>();
  let len = 0;
  let best = 0;
  for (let k = first; k <= today; k = addDays(k, 1)) {
    if (done.has(k)) {
      len++;
      best = Math.max(best, len);
      continue;
    }
    if (k === today) break; // today still open
    const w = weekKey(k);
    // a freeze only bridges a single missed day: the next day must be active or today
    const next = addDays(k, 1);
    if (len > 0 && !weeksUsed.has(w) && (done.has(next) || next === today)) {
      weeksUsed.add(w);
      frozen.push(k);
      continue;
    }
    len = 0;
  }
  return {
    current: len,
    best,
    todayDone: done.has(today),
    frozenDays: frozen,
    freezeAvailableThisWeek: !weeksUsed.has(weekKey(today)),
  };
}

// ---------- problems ----------
export type ProblemStatus = "todo" | "started" | "done";
export interface ProblemProgress {
  problem_id: string;
  status: ProblemStatus;
  started_at: string | null;
  completed_at: string | null;
  confidence: number | null;
}

export function allProblemProgress(): Record<string, ProblemProgress> {
  return Object.fromEntries(all<ProblemProgress>("SELECT * FROM problem_progress").map((p) => [p.problem_id, p]));
}

export function markStarted(problemId: string) {
  run(
    `INSERT INTO problem_progress (problem_id, status, started_at) VALUES (?, 'started', ?)
     ON CONFLICT(problem_id) DO UPDATE SET status = CASE WHEN status = 'todo' THEN 'started' ELSE status END,
       started_at = COALESCE(started_at, excluded.started_at)`,
    [problemId, nowIso()],
  );
}

export function markDone(problemId: string, confidence: number) {
  run(
    `INSERT INTO problem_progress (problem_id, status, started_at, completed_at, confidence)
     VALUES (?, 'done', ?, ?, ?)
     ON CONFLICT(problem_id) DO UPDATE SET status='done', completed_at=excluded.completed_at, confidence=excluded.confidence`,
    [problemId, nowIso(), nowIso(), confidence],
  );
  logActivity("problem_done", problemId);
}

export function markUndone(problemId: string) {
  run("UPDATE problem_progress SET status='started', completed_at=NULL WHERE problem_id=?", [problemId]);
  // remove today's completion so the streak reflects reality
  run("DELETE FROM activity WHERE kind='problem_done' AND ref=? AND day=?", [problemId, dayKey()]);
}

// ---------- answers / boards ----------
export function getAnswers(problemId: string): Record<string, string> {
  return Object.fromEntries(
    all<{ step: string; content: string }>("SELECT step, content FROM answers WHERE problem_id=?", [problemId]).map(
      (r) => [r.step, r.content],
    ),
  );
}
export function saveAnswer(problemId: string, step: string, content: string) {
  run(
    `INSERT INTO answers (problem_id, step, content, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(problem_id, step) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at`,
    [problemId, step, content, nowIso()],
  );
}
export function getBoard(problemId: string): string | undefined {
  return one<{ scene: string }>("SELECT scene FROM boards WHERE problem_id=?", [problemId])?.scene;
}
export function saveBoard(problemId: string, scene: string) {
  run(
    `INSERT INTO boards (problem_id, scene, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(problem_id) DO UPDATE SET scene=excluded.scene, updated_at=excluded.updated_at`,
    [problemId, scene, nowIso()],
  );
}

// ---------- concepts / patterns read ----------
export function doneItems(): Set<string> {
  return new Set(all<{ item_id: string }>("SELECT item_id FROM item_done").map((r) => r.item_id));
}
export function toggleItem(id: string, on: boolean) {
  if (on) {
    run("INSERT OR IGNORE INTO item_done (item_id, done_at) VALUES (?, ?)", [id, nowIso()]);
    logActivity("read", id);
  } else run("DELETE FROM item_done WHERE item_id=?", [id]);
}

// ---------- AI artifacts ----------
export function getFeedback(problemId: string): Record<string, string> {
  return Object.fromEntries(
    all<{ step: string; content: string }>("SELECT step, content FROM ai_feedback WHERE problem_id=?", [problemId]).map(
      (r) => [r.step, r.content],
    ),
  );
}
export function saveFeedback(problemId: string, step: string, content: string) {
  run(
    `INSERT INTO ai_feedback (problem_id, step, content, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(problem_id, step) DO UPDATE SET content=excluded.content, created_at=excluded.created_at`,
    [problemId, step, content, nowIso()],
  );
}
export function getGeneratedRefs(problemId: string): Record<string, string> {
  return Object.fromEntries(
    all<{ step: string; content: string }>("SELECT step, content FROM generated_refs WHERE problem_id=?", [
      problemId,
    ]).map((r) => [r.step, r.content]),
  );
}
export function saveGeneratedRef(problemId: string, step: string, content: string) {
  run(
    `INSERT INTO generated_refs (problem_id, step, content, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(problem_id, step) DO UPDATE SET content=excluded.content, created_at=excluded.created_at`,
    [problemId, step, content, nowIso()],
  );
}
