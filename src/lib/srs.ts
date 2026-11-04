import { all, run } from "./db";
import { addDays, dayKey, logActivity } from "./progress";

export interface DrillState {
  drill_id: string;
  reps: number;
  ease: number;
  interval_days: number;
  due: string;
  lapses: number;
  last_correct: number | null;
}

export function drillStates(): Record<string, DrillState> {
  return Object.fromEntries(all<DrillState>("SELECT * FROM drill_state").map((d) => [d.drill_id, d]));
}

/**
 * SM-2-lite. grade: 0 = wrong, 1 = partially right, 2 = right.
 * Wrong answers come back tomorrow; right answers spread out.
 */
export function review(drillId: string, grade: 0 | 1 | 2, prev?: DrillState) {
  const s: DrillState = prev ?? {
    drill_id: drillId, reps: 0, ease: 2.5, interval_days: 0, due: dayKey(), lapses: 0, last_correct: null,
  };
  let { reps, ease, interval_days, lapses } = s;
  if (grade === 0) {
    reps = 0;
    lapses++;
    interval_days = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps++;
    const q = grade === 2 ? 5 : 3;
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    interval_days = reps === 1 ? (grade === 2 ? 2 : 1) : reps === 2 ? (grade === 2 ? 5 : 3) : Math.round(interval_days * ease * (grade === 2 ? 1 : 0.7));
  }
  const due = addDays(dayKey(), interval_days);
  run(
    `INSERT INTO drill_state (drill_id, reps, ease, interval_days, due, lapses, last_correct)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(drill_id) DO UPDATE SET reps=excluded.reps, ease=excluded.ease, interval_days=excluded.interval_days,
       due=excluded.due, lapses=excluded.lapses, last_correct=excluded.last_correct`,
    [drillId, reps, ease, interval_days, due, lapses, grade],
  );
  logActivity("drill", drillId);
}

export function isDue(s: DrillState | undefined, today = dayKey()) {
  return !s || s.due <= today;
}
