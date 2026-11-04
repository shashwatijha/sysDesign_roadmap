import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PROBLEMS, PROBLEM_BY_ID } from "../data/problems";
import { PATTERNS } from "../data/patterns";
import { DRILLS } from "../data/drills";
import { Heatmap } from "../components/Heatmap";
import { DifficultyChip, Flame } from "../components/bits";
import { activityByDay, allProblemProgress, computeStreak } from "../lib/progress";
import { drillStates } from "../lib/srs";
import { useDbVersion } from "../lib/useDb";

export default function ProgressPage() {
  const v = useDbVersion();
  const d = useMemo(() => {
    const problems = allProblemProgress();
    const states = drillStates();
    const solved = Object.values(problems).filter((p) => p.status === "done");
    const byDiff = (["easy", "medium", "hard"] as const).map((k) => ({
      k, done: solved.filter((s) => PROBLEM_BY_ID[s.problem_id]?.difficulty === k).length,
      total: PROBLEMS.filter((p) => p.difficulty === k).length,
    }));
    // pattern accuracy from drills: share of drills (per pattern) whose last answer was fully right
    const patternStats = PATTERNS.map((pt) => {
      const ds = DRILLS.filter((x) => x.answers.includes(pt.id));
      const seen = ds.filter((x) => states[x.id]);
      const right = seen.filter((x) => states[x.id].last_correct === 2).length;
      return { pt, total: ds.length, seen: seen.length, right };
    });
    return {
      learned: Object.values(states).filter((s) => s.reps >= 2).length,
      streak: computeStreak(), heat: activityByDay(), byDiff, patternStats,
      recent: solved.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")).slice(0, 12),
    };
  }, [v]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Current streak" value={d.streak.current} icon={<Flame lit={d.streak.todayDone} />} />
        <Stat label="Best streak" value={d.streak.best} />
        <Stat label="Problems solved" value={`${d.byDiff.reduce((a, x) => a + x.done, 0)}/${PROBLEMS.length}`} />
        <Stat label="Drills learned" value={`${d.learned}/${DRILLS.length}`} />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Activity</h2>
          <span className="text-xs text-mute">
            A day counts when you finish a problem. One missed day per week is auto-forgiven
            ({d.streak.freezeAvailableThisWeek ? "available this week" : "used this week"}).
          </span>
        </div>
        <Heatmap data={d.heat} frozen={new Set(d.streak.frozenDays)} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-semibold">By difficulty</h2>
          <div className="mt-3 space-y-3">
            {d.byDiff.map((x) => (
              <div key={x.k}>
                <div className="flex justify-between text-sm"><span className="capitalize">{x.k}</span><span className="text-mute">{x.done}/{x.total}</span></div>
                <Bar pct={x.total ? x.done / x.total : 0} />
              </div>
            ))}
          </div>
          <h2 className="mt-6 font-semibold">Recently solved</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {d.recent.length === 0 && <li className="text-mute">Nothing yet.</li>}
            {d.recent.map((r) => {
              const p = PROBLEM_BY_ID[r.problem_id];
              if (!p) return null;
              return (
                <li key={r.problem_id} className="flex items-center gap-2">
                  <Link className="hover:text-emerald-300" to={`/problem/${p.id}`}>{p.title}</Link>
                  <DifficultyChip d={p.difficulty} />
                  <span className="ml-auto text-xs text-mute">
                    {["", "shaky", "ok", "solid"][r.confidence ?? 0]} · {r.completed_at?.slice(0, 10)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold">Pattern recognition</h2>
          <p className="text-xs text-mute">Last drill result per pattern. Weak ones are what to drill next.</p>
          <div className="mt-3 space-y-3">
            {d.patternStats.map(({ pt, total, seen, right }) => (
              <div key={pt.id}>
                <div className="flex justify-between text-sm">
                  <Link to={`/drills?pattern=${pt.id}`} className="hover:text-emerald-300">{pt.title}</Link>
                  <span className="text-mute">{seen ? `${right}/${seen} right` : "not drilled"} · {total} drills</span>
                </div>
                <Bar pct={seen ? right / seen : 0} color={seen && right / seen < 0.6 ? "bg-amber-400" : "bg-emerald-500"} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs capitalize text-mute">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-3xl font-bold">{value} {icon}</div>
    </div>
  );
}

function Bar({ pct, color = "bg-emerald-500" }: { pct: number; color?: string }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel2">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
}
