import { Link } from "react-router-dom";
import { PATTERN_BY_ID } from "../data/patterns";
import { CONCEPT_BY_ID } from "../data/concepts";
import type { Difficulty } from "../data/types";

const DIFF: Record<Difficulty, string> = {
  easy: "text-emerald-300 border-emerald-500/40",
  medium: "text-amber-300 border-amber-500/40",
  hard: "text-rose-300 border-rose-500/40",
};

export function DifficultyChip({ d }: { d: Difficulty }) {
  return <span className={`chip capitalize ${DIFF[d]}`}>{d}</span>;
}

export function PatternChip({ id }: { id: string }) {
  const p = PATTERN_BY_ID[id];
  if (!p) return <span className="chip">{id}</span>;
  return (
    <Link to={`/learn/${id}`} className="chip border-teal-500/40 text-teal-300 hover:bg-teal-500/10">
      {p.title}
    </Link>
  );
}

export function ConceptChip({ id }: { id: string }) {
  const c = CONCEPT_BY_ID[id];
  if (!c) return null;
  return (
    <Link to={`/learn/${id}`} className="chip hover:bg-white/5">
      {c.title}
    </Link>
  );
}

export function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${
        on ? "border-emerald-400 bg-emerald-500 text-emerald-950" : "border-line"
      }`}
    >
      {on ? "✓" : ""}
    </span>
  );
}

export function Flame({ lit }: { lit: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={lit ? "#fb923c" : "none"} stroke={lit ? "#fb923c" : "currentColor"} strokeWidth="2">
      <path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 11 11c0-4 1-9 1-9z" />
    </svg>
  );
}

