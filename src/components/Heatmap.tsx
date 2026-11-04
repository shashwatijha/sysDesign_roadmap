import { addDays, dayKey, parseDay } from "../lib/progress";

const LEVELS = ["#2a2b31", "#0e4429", "#006d32", "#26a641", "#39d353"];

/** GitHub-style calendar of the last 53 weeks. */
export function Heatmap({ data, frozen }: { data: Map<string, { problems: number; total: number }>; frozen: Set<string> }) {
  const today = dayKey();
  const end = parseDay(today);
  // start on the Sunday 52 weeks ago
  const start = addDays(today, -(52 * 7 + end.getDay()));
  const weeks: string[][] = [];
  for (let k = start, w: string[] = []; k <= today; k = addDays(k, 1)) {
    w.push(k);
    if (w.length === 7 || k === today) { weeks.push(w); w = []; }
  }
  const level = (k: string) => {
    const e = data.get(k);
    if (!e) return 0;
    if (e.problems >= 3) return 4;
    if (e.problems === 2) return 3;
    if (e.problems === 1) return 2;
    return e.total > 0 ? 1 : 0;
  };
  const months: { col: number; label: string }[] = [];
  weeks.forEach((w, i) => {
    const d = parseDay(w[0]);
    if (d.getDate() <= 7) months.push({ col: i, label: d.toLocaleString(undefined, { month: "short" }) });
  });

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div className="relative ml-6 h-4 text-[10px] text-mute">
          {months.map((m) => <span key={m.col} className="absolute" style={{ left: m.col * 13 }}>{m.label}</span>)}
        </div>
        <div className="flex gap-[3px]">
          <div className="mr-1 flex w-5 flex-col gap-[3px] text-[9px] text-mute">
            {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => <span key={i} className="h-[10px] leading-[10px]">{d}</span>)}
          </div>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map((k) => {
                const e = data.get(k);
                const fz = frozen.has(k);
                return (
                  <div
                    key={k}
                    title={`${k}: ${e?.problems ?? 0} problem(s)${fz ? " · streak freeze" : ""}`}
                    className={`h-[10px] w-[10px] rounded-[2px] ${fz ? "ring-1 ring-sky-400" : ""} ${k === today ? "outline outline-1 outline-white/40" : ""}`}
                    style={{ background: fz && !e ? "#0c4a6e" : LEVELS[level(k)] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-mute">
          Less {LEVELS.map((c) => <span key={c} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: c }} />)} More
          <span className="ml-3 h-[10px] w-[10px] rounded-[2px] bg-[#0c4a6e] ring-1 ring-sky-400" /> freeze
        </div>
      </div>
    </div>
  );
}
