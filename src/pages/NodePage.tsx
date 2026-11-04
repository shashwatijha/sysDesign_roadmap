import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { NODE_BY_ID } from "../data/roadmap";
import { itemsForNode } from "../lib/content";
import { allProblemProgress, doneItems, toggleItem } from "../lib/progress";
import { useDbVersion } from "../lib/useDb";
import { Check, DifficultyChip, PatternChip } from "../components/bits";

export default function NodePage() {
  const { id = "" } = useParams();
  const node = NODE_BY_ID[id];
  const v = useDbVersion();
  const { done, problems } = useMemo(() => ({ done: doneItems(), problems: allProblemProgress() }), [v]);
  if (!node) return <main className="p-8 text-mute">Unknown roadmap node.</main>;
  const items = itemsForNode(node);
  const parents = node.parents.map((p) => NODE_BY_ID[p]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="text-sm text-mute hover:text-ink">← Roadmap</Link>
      <h1 className="mt-2 text-2xl font-semibold">{node.title}</h1>
      <p className="mt-1 text-mute">{node.blurb}</p>
      {parents.length > 0 && (
        <p className="mt-2 text-xs text-mute">
          Builds on: {parents.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <Link className="underline hover:text-ink" to={`/node/${p.id}`}>{p.title}</Link>
            </span>
          ))}
        </p>
      )}

      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {items.map((it) => {
          const status = it.kind === "problem" ? problems[it.id]?.status ?? "todo" : done.has(it.id) ? "done" : "todo";
          return (
            <li key={it.id} className="flex items-start gap-3 bg-panel p-4 hover:bg-panel2">
              <button
                className="mt-0.5"
                aria-label="toggle done"
                disabled={it.kind === "problem"}
                title={it.kind === "problem" ? "Finish the problem to complete it" : "Mark as read"}
                onClick={() => toggleItem(it.id, status !== "done")}
              >
                <Check on={status === "done"} />
              </button>
              <Link to={it.href} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{it.title}</span>
                  {it.difficulty && <DifficultyChip d={it.difficulty} />}
                  {status === "started" && <span className="chip text-sky-300">in progress</span>}
                  {it.stub && <span className="chip" title="Reference answers drafted by Claude on demand">AI reference</span>}
                </div>
                <p className="mt-0.5 text-sm text-mute">{it.summary}</p>
              </Link>
              {it.tags && (
                <div className="hidden max-w-[40%] flex-wrap justify-end gap-1 sm:flex">
                  {it.tags.map((t) => <PatternChip key={t} id={t} />)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {node.kind === "problems" && (
        <p className="mt-3 text-xs text-mute">
          Tip: pattern tags are hidden on the problem page until you guess them. Try not to peek here.
        </p>
      )}
    </main>
  );
}
