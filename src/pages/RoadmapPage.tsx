import { useMemo } from "react";
import { Link } from "react-router-dom";
import { RoadmapGraph } from "../components/RoadmapGraph";
import { NODES } from "../data/roadmap";
import { DRILLS } from "../data/drills";
import { PROBLEMS } from "../data/problems";
import { nextProblem, nodeProgress } from "../lib/content";
import { allProblemProgress, computeStreak, doneItems } from "../lib/progress";
import { drillStates, isDue } from "../lib/srs";
import { useDbVersion } from "../lib/useDb";
import { DifficultyChip, Flame } from "../components/bits";

export default function RoadmapPage() {
  const v = useDbVersion();
  const data = useMemo(() => {
    const done = doneItems();
    const problems = allProblemProgress();
    const progress = Object.fromEntries(NODES.map((n) => [n.id, nodeProgress(n, done, problems)]));
    const states = drillStates();
    const due = DRILLS.filter((d) => isDue(states[d.id])).length;
    const solved = Object.values(problems).filter((p) => p.status === "done").length;
    return { progress, next: nextProblem(problems), streak: computeStreak(), due, solved };
  }, [v]);

  const { next, streak } = data;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <section className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-mute">Today's problem</div>
          {next ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-lg font-semibold">{next.title}</h2>
                <DifficultyChip d={next.difficulty} />
              </div>
              <p className="mt-1 text-sm text-mute">{next.prompt}</p>
              <Link to={`/problem/${next.id}`} className="btn btn-primary mt-3">Start →</Link>
            </>
          ) : (
            <p className="mt-2 text-sm">Every problem is done. Re-do one from memory, or ask Claude for a fresh one in Settings.</p>
          )}
        </div>
        <div className="card flex flex-col justify-between p-4">
          <div className="text-xs uppercase tracking-wider text-mute">Streak</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{streak.current}</span>
            <span className="text-mute">day{streak.current === 1 ? "" : "s"}</span>
            <Flame lit={streak.todayDone} />
          </div>
          <div className="text-xs text-mute">
            Best {streak.best} · {streak.todayDone ? "today counted ✓" : "finish 1 problem today"} ·{" "}
            {streak.freezeAvailableThisWeek ? "1 freeze left this week" : "freeze used this week"}
          </div>
        </div>
        <div className="card flex flex-col justify-between p-4">
          <div className="text-xs uppercase tracking-wider text-mute">Pattern drills</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{data.due}</span>
            <span className="text-mute">due</span>
          </div>
          <Link to="/drills" className="text-sm text-emerald-400 hover:underline">
            Train recognition →
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Roadmap</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-mute">
            <Legend cls="bg-[#3d5a80]" label="Framework" />
            <Legend cls="bg-node" label="Concepts" />
            <Legend cls="bg-[#2f5d62]" label="Patterns" />
            <Legend cls="bg-[#5a3f6e]" label="Problems" />
            <Legend cls="bg-[#2f6b4f]" label="Complete" />
            <span>
              {data.solved}/{PROBLEMS.length} problems solved
            </span>
          </div>
        </div>
        <RoadmapGraph progress={data.progress} />
      </section>
    </main>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${cls}`} /> {label}
    </span>
  );
}
