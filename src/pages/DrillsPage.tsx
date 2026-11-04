import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DRILLS } from "../data/drills";
import { PATTERN_BY_ID } from "../data/patterns";
import type { Drill } from "../data/types";
import { drillStates, isDue, review } from "../lib/srs";
import { useDbVersion } from "../lib/useDb";
import { PatternChip } from "../components/bits";

function shuffle<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DrillsPage() {
  const v = useDbVersion();
  const [params] = useSearchParams();
  const filter = params.get("pattern");
  const [mode, setMode] = useState<"due" | "all">(filter ? "all" : "due");
  // freeze the queue for this session so answered cards don't reshuffle it
  const [sessionKey, setSessionKey] = useState(0);
  const states = useMemo(() => drillStates(), [v]);

  const queue = useMemo(() => {
    const pool = DRILLS.filter((d) => !filter || d.answers.includes(filter));
    const st = drillStates();
    const list = mode === "due" ? pool.filter((d) => isDue(st[d.id])) : pool;
    return shuffle(list, Date.now() % 100000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filter, sessionKey]);

  const [idx, setIdx] = useState(0);
  const current = queue[idx];
  const learned = Object.values(states).filter((s) => s.reps >= 2).length;
  const dueNow = DRILLS.filter((d) => isDue(states[d.id])).length;

  const restart = (m: "due" | "all") => { setMode(m); setIdx(0); setSessionKey((k) => k + 1); };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Pattern drills</h1>
      <p className="mt-1 text-sm text-mute">
        Read the scenario, pick every pattern that applies. Misses come back tomorrow; hits spread out over days.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="chip">{dueNow} due</span>
        <span className="chip">{learned}/{DRILLS.length} learned</span>
        {filter && (
          <span className="flex items-center gap-1 text-mute">
            filtered: <PatternChip id={filter} /> <Link to="/drills" className="underline">clear</Link>
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button className={`btn py-1 ${mode === "due" ? "border-emerald-500" : ""}`} onClick={() => restart("due")}>Due</button>
          <button className={`btn py-1 ${mode === "all" ? "border-emerald-500" : ""}`} onClick={() => restart("all")}>All</button>
        </div>
      </div>

      {current ? (
        <DrillCard
          key={`${sessionKey}-${current.id}`}
          drill={current}
          n={idx + 1}
          total={queue.length}
          onNext={() => setIdx(idx + 1)}
          onGrade={(g) => review(current.id, g, states[current.id])}
        />
      ) : (
        <div className="card mt-6 p-8 text-center">
          <div className="text-lg font-medium">{queue.length ? "Session done." : "Nothing due."}</div>
          <p className="mt-1 text-sm text-mute">Come back tomorrow, or practice everything.</p>
          <button className="btn mt-4" onClick={() => restart("all")}>Practice all {DRILLS.length}</button>
        </div>
      )}
    </main>
  );
}

function DrillCard({ drill, n, total, onNext, onGrade }: {
  drill: Drill; n: number; total: number; onNext: () => void; onGrade: (g: 0 | 1 | 2) => void;
}) {
  const options = useMemo(
    () => shuffle([...drill.answers, ...drill.distractors], drill.id.length * 7919 + n),
    [drill, n],
  );
  const [picks, setPicks] = useState<string[]>([]);
  const [grade, setGrade] = useState<0 | 1 | 2 | null>(null);

  const submit = () => {
    const right = picks.filter((p) => drill.answers.includes(p)).length;
    const wrong = picks.length - right;
    const g: 0 | 1 | 2 = right === drill.answers.length && wrong === 0 ? 2 : right > 0 ? 1 : 0;
    setGrade(g);
    onGrade(g);
  };

  return (
    <div className="card mt-6 p-5">
      <div className="text-xs text-mute">{n} / {total}</div>
      <p className="mt-2 text-lg leading-relaxed">{drill.scenario}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const picked = picks.includes(o);
          const correct = drill.answers.includes(o);
          let cls = picked ? "border-sky-400 bg-sky-500/10" : "hover:bg-panel2";
          if (grade !== null) {
            cls = correct ? "border-emerald-400 bg-emerald-500/10" : picked ? "border-rose-400 bg-rose-500/10" : "opacity-50";
          }
          return (
            <button
              key={o}
              disabled={grade !== null}
              onClick={() => setPicks((x) => (x.includes(o) ? x.filter((y) => y !== o) : [...x, o]))}
              className={`rounded-lg border border-line p-3 text-left text-sm ${cls}`}
            >
              <div className="font-medium">{PATTERN_BY_ID[o]?.title ?? o}</div>
              <div className="text-xs text-mute">{PATTERN_BY_ID[o]?.summary}</div>
            </button>
          );
        })}
      </div>
      {grade === null ? (
        <button className="btn btn-primary mt-4" disabled={!picks.length} onClick={submit}>Check</button>
      ) : (
        <div className="mt-4">
          <div className={`text-sm font-semibold ${grade === 2 ? "text-ok" : grade === 1 ? "text-warn" : "text-bad"}`}>
            {grade === 2 ? "Correct" : grade === 1 ? "Partly right" : "Missed"}
          </div>
          <p className="mt-1 text-sm text-mute">{drill.explanation}</p>
          <button className="btn btn-primary mt-3" onClick={onNext}>Next →</button>
        </div>
      )}
    </div>
  );
}
