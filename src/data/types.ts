export type Difficulty = "easy" | "medium" | "hard";

export type NodeKind = "framework" | "concept" | "pattern" | "problems";

/** A box on the roadmap graph. Groups concepts, patterns or problems. */
export interface RoadmapNode {
  id: string;
  title: string;
  kind: NodeKind;
  blurb: string;
  /** grid position: col (0..6), row (0..n) */
  x: number;
  y: number;
  parents: string[];
}

export interface Concept {
  id: string;
  node: string;
  title: string;
  summary: string;
  /** markdown */
  body: string;
}

export interface Pattern {
  id: string;
  node: string;
  title: string;
  summary: string;
  /** phrases in a prompt / requirement that should make you think of this pattern */
  signals: string[];
  /** markdown */
  body: string;
}

export type StepId = "requirements" | "entities" | "api" | "highLevel" | "deepDives";

export interface StepDef {
  id: StepId;
  title: string;
  minutes: number;
  /** what the step asks of you, generic across problems */
  guide: string;
}

export interface DeepDive {
  question: string;
  /** markdown: options and the recommended answer */
  answer: string;
}

export interface ProblemSteps {
  requirements: string;
  entities: string;
  api: string;
  highLevel: string;
  deepDives: DeepDive[];
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  patterns: string[];
  concepts: string[];
  /** the interviewer's opening line */
  prompt: string;
  /** hints per step, revealed one at a time */
  hints?: Partial<Record<StepId, string[]>>;
  /** reference answers. Missing = stub problem (Claude can draft one). */
  reference?: ProblemSteps;
}

export interface Drill {
  id: string;
  scenario: string;
  /** pattern ids or concept ids that apply */
  answers: string[];
  /** extra wrong options (pattern/concept ids) to mix in */
  distractors: string[];
  explanation: string;
}
