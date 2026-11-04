import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { CONCEPT_BY_ID } from "../data/concepts";
import { PATTERN_BY_ID } from "../data/patterns";
import { PROBLEMS } from "../data/problems";
import { DRILLS } from "../data/drills";
import { NODE_BY_ID } from "../data/roadmap";
import { Markdown } from "../components/Markdown";
import { DifficultyChip } from "../components/bits";
import { doneItems, toggleItem } from "../lib/progress";
import { useDbVersion } from "../lib/useDb";

export default function LearnPage() {
  const { id = "" } = useParams();
  const v = useDbVersion();
  const done = useMemo(() => doneItems(), [v]);
  const concept = CONCEPT_BY_ID[id];
  const pattern = PATTERN_BY_ID[id];
  const item = concept ?? pattern;
  if (!item) return <main className="p-8 text-mute">Not found.</main>;
  const node = NODE_BY_ID[item.node];
  const isDone = done.has(id);

  const related = PROBLEMS.filter((p) => (pattern ? p.patterns.includes(id) : p.concepts.includes(id)));
  const drillCount = pattern ? DRILLS.filter((d) => d.answers.includes(id)).length : 0;

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_260px]">
      <article>
        <Link to={`/node/${node.id}`} className="text-sm text-mute hover:text-ink">← {node.title}</Link>
        <div className="mt-2 flex items-center gap-2">
          <span className={`chip ${pattern ? "border-teal-500/40 text-teal-300" : ""}`}>{pattern ? "Pattern" : "Concept"}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{item.title}</h1>
        <p className="mt-1 text-mute">{item.summary}</p>

        {pattern && (
          <div className="card mt-4 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-300">Signals in a prompt</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pattern.signals.map((s) => <span key={s} className="chip text-ink">"{s}"</span>)}
            </div>
          </div>
        )}

        <div className="mt-4">
          <Markdown text={item.body} />
        </div>

        <button
          onClick={() => toggleItem(id, !isDone)}
          className={`btn mt-6 ${isDone ? "" : "btn-primary"}`}
        >
          {isDone ? "✓ Marked as learned (undo)" : "Mark as learned"}
        </button>
      </article>

      <aside className="space-y-4">
        {related.length > 0 && (
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-mute">Practice with</div>
            <ul className="mt-2 space-y-2">
              {related.map((p) => (
                <li key={p.id}>
                  <Link to={`/problem/${p.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-emerald-300">
                    {p.title} <DifficultyChip d={p.difficulty} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {drillCount > 0 && (
          <Link to={`/drills?pattern=${id}`} className="card block p-4 text-sm hover:bg-panel2">
            <span className="font-medium">{drillCount} drills</span> <span className="text-mute">feature this pattern →</span>
          </Link>
        )}
      </aside>
    </main>
  );
}
