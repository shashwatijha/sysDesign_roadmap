import { useNavigate } from "react-router-dom";
import { NODES, NODE_BY_ID } from "../data/roadmap";
import type { RoadmapNode } from "../data/types";

const COL = 150;
const ROW = 118;
const W = 172;
const H = 54;
const PAD = 24;

const pos = (n: RoadmapNode) => ({ left: PAD + n.x * COL, top: PAD + n.y * ROW });

const KIND_STYLE: Record<string, string> = {
  framework: "bg-[#3d5a80] border-[#5a7db0]",
  concept: "bg-node border-node-hi",
  pattern: "bg-[#2f5d62] border-[#3f7d84]",
  problems: "bg-[#5a3f6e] border-[#7a5a92]",
};
const DIFF_RING: Record<string, string> = {
  easy: "ring-2 ring-emerald-400/60",
  medium: "ring-2 ring-amber-400/60",
  hard: "ring-2 ring-rose-400/60",
};

export function RoadmapGraph({ progress }: { progress: Record<string, { done: number; total: number }> }) {
  const nav = useNavigate();
  const maxX = Math.max(...NODES.map((n) => n.x));
  const maxY = Math.max(...NODES.map((n) => n.y));
  const width = PAD * 2 + maxX * COL + W;
  const height = PAD * 2 + maxY * ROW + H;

  const edges = NODES.flatMap((child) =>
    child.parents.map((pid) => {
      const parent = NODE_BY_ID[pid];
      const a = pos(parent);
      const b = pos(child);
      const x1 = a.left + W / 2, y1 = a.top + H;
      const x2 = b.left + W / 2, y2 = b.top;
      const dy = Math.max(30, (y2 - y1) / 2);
      const complete = (progress[pid]?.total ?? 0) > 0 && progress[pid].done === progress[pid].total;
      return (
        <path
          key={`${pid}-${child.id}`}
          d={`M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`}
          fill="none"
          stroke={complete ? "#34d39988" : "#55565d"}
          strokeWidth={2}
        />
      );
    }),
  );

  return (
    <div className="dots overflow-x-auto rounded-xl border border-line">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg className="absolute inset-0" width={width} height={height} aria-hidden>
          {edges}
        </svg>
        {NODES.map((n) => {
          const p = progress[n.id] ?? { done: 0, total: 0 };
          const pct = p.total ? (p.done / p.total) * 100 : 0;
          const complete = p.total > 0 && p.done === p.total;
          const { left, top } = pos(n);
          return (
            <button
              key={n.id}
              onClick={() => nav(`/node/${n.id}`)}
              title={n.blurb}
              style={{ left, top, width: W, height: H }}
              className={`group absolute flex flex-col justify-center rounded-lg border px-3 text-center shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:brightness-110 ${
                complete ? "bg-[#2f6b4f] border-[#3f8f69]" : KIND_STYLE[n.kind]
              } ${DIFF_RING[n.id] ?? ""}`}
            >
              <span className="text-[13px] font-semibold leading-tight text-white">{n.title}</span>
              <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/85">
                <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </span>
              <span className="pointer-events-none absolute -top-2 right-2 rounded bg-black/60 px-1.5 text-[10px] text-white/80 opacity-0 group-hover:opacity-100">
                {p.done}/{p.total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
