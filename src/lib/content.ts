import { CONCEPTS } from "../data/concepts";
import { PATTERNS } from "../data/patterns";
import { PROBLEMS } from "../data/problems";
import { NODES } from "../data/roadmap";
import type { Difficulty, RoadmapNode } from "../data/types";
import type { ProblemProgress } from "./progress";

export interface NodeItem {
  id: string;
  title: string;
  summary: string;
  href: string;
  kind: "concept" | "pattern" | "problem";
  difficulty?: Difficulty;
  stub?: boolean;
  tags?: string[];
}

const DIFF_FOR_NODE: Record<string, Difficulty> = { easy: "easy", medium: "medium", hard: "hard" };

export function itemsForNode(node: RoadmapNode): NodeItem[] {
  if (node.kind === "problems") {
    const d = DIFF_FOR_NODE[node.id];
    return PROBLEMS.filter((p) => p.difficulty === d).map((p) => ({
      id: p.id, title: p.title, summary: p.prompt, href: `/problem/${p.id}`, kind: "problem",
      difficulty: p.difficulty, stub: !p.reference, tags: p.patterns,
    }));
  }
  if (node.kind === "pattern") {
    return PATTERNS.filter((p) => p.node === node.id).map((p) => ({
      id: p.id, title: p.title, summary: p.summary, href: `/learn/${p.id}`, kind: "pattern",
    }));
  }
  return CONCEPTS.filter((c) => c.node === node.id).map((c) => ({
    id: c.id, title: c.title, summary: c.summary, href: `/learn/${c.id}`, kind: "concept",
  }));
}

export function nodeProgress(
  node: RoadmapNode,
  done: Set<string>,
  problems: Record<string, ProblemProgress>,
): { done: number; total: number } {
  const items = itemsForNode(node);
  const n = items.filter((i) => (i.kind === "problem" ? problems[i.id]?.status === "done" : done.has(i.id))).length;
  return { done: n, total: items.length };
}

/** Roadmap order: framework → concepts → patterns → problems by difficulty. */
export function nextProblem(problems: Record<string, ProblemProgress>) {
  const order: Difficulty[] = ["easy", "medium", "hard"];
  for (const d of order) {
    // full problems first, then stubs
    const list = PROBLEMS.filter((p) => p.difficulty === d).sort((a, b) => Number(!a.reference) - Number(!b.reference));
    const started = list.find((p) => problems[p.id]?.status === "started");
    if (started) return started;
    const todo = list.find((p) => (problems[p.id]?.status ?? "todo") === "todo");
    if (todo) return todo;
  }
  return undefined;
}

export const nodeOfItem = (id: string) => {
  const c = CONCEPTS.find((x) => x.id === id) ?? PATTERNS.find((x) => x.id === id);
  return c ? NODES.find((n) => n.id === c.node) : undefined;
};
