import Anthropic from "@anthropic-ai/sdk";
import type { Problem, StepDef } from "../data/types";

/**
 * Claude calls go straight from the browser with the user's own key.
 * The key lives only in this browser's localStorage, never in the SQLite file
 * (so DB exports are safe to share).
 */

const KEY_LS = "sdd.anthropicKey";
const MODEL_LS = "sdd.model";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best feedback)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (cheaper)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (cheapest)" },
];

function ls(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
export const getApiKey = () => ls(KEY_LS) ?? "";
export const getModel = () => ls(MODEL_LS) ?? MODELS[0].id;
export function setApiKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY_LS, k.trim());
    else localStorage.removeItem(KEY_LS);
  } catch { /* storage blocked */ }
}
export function setModel(m: string) {
  try { localStorage.setItem(MODEL_LS, m); } catch { /* storage blocked */ }
}
export const hasApiKey = () => getApiKey().length > 0;

function client() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Add your Anthropic API key in Settings first.");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const SYSTEM = `You are a senior staff engineer running a system design interview practice session.
The candidate works through a fixed delivery framework: Requirements, Core Entities, API, High-Level Design, Deep Dives.
Be direct and specific. No praise padding. Point out what is missing, what is wrong, and what an interviewer would push on next.
Prefer concrete numbers, named technologies only when they matter, and explicit tradeoffs.
Use short markdown: headings, bullets, no tables wider than 3 columns.`;

export interface StreamHandlers {
  onText: (full: string) => void;
  signal?: AbortSignal;
}

async function streamText(prompt: string, { onText, signal }: StreamHandlers, effort: "low" | "medium" | "high" = "medium") {
  const c = client();
  const model = getModel();
  // Server-side fallback re-runs a safety-declined request on another model.
  // Only the "default" form is used, which Sonnet 5.5 also accepts on the Claude API.
  const stream = c.beta.messages.stream(
    {
      model,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort },
      messages: [{ role: "user", content: prompt }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { signal },
  );
  let text = "";
  stream.on("text", (delta) => {
    text += delta;
    onText(text);
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    text += "\n\n> Claude declined to answer this one.";
    onText(text);
  }
  return text;
}

function problemHeader(p: Problem) {
  return `Problem: ${p.title} (${p.difficulty})\nInterviewer prompt: "${p.prompt}"`;
}

export function feedbackOnStep(
  p: Problem,
  step: StepDef,
  answers: Record<string, string>,
  reference: string | undefined,
  h: StreamHandlers,
) {
  const prior = Object.entries(answers)
    .filter(([k, v]) => k !== step.id && v.trim())
    .map(([k, v]) => `### Candidate's ${k}\n${v}`)
    .join("\n\n");
  const prompt = `${problemHeader(p)}

Current step: **${step.title}**. What this step should cover: ${step.guide}

${prior ? `Earlier steps the candidate wrote (context only):\n${prior}\n` : ""}
### Candidate's answer for ${step.title}
${answers[step.id]?.trim() || "(empty)"}

${reference ? `### Reference answer (use as a rubric, do not just paste it back)\n${reference}\n` : ""}
Give feedback in this shape:
1. **Score: N/5** with one line on why.
2. **Missing** (bullets): the most important gaps, highest impact first.
3. **Wrong or risky** (bullets, or "none").
4. **Interviewer follow-up**: the one question you'd ask next.
Keep it under 250 words.`;
  return streamText(prompt, h, "medium");
}

export function fullReview(p: Problem, answers: Record<string, string>, h: StreamHandlers) {
  const body = ["requirements", "entities", "api", "highLevel", "deepDives"]
    .map((k) => `### ${k}\n${answers[k]?.trim() || "(empty)"}`)
    .join("\n\n");
  const prompt = `${problemHeader(p)}

Here is the candidate's full design:
${body}

Grade it as a hiring signal for a mid/senior backend role.
- **Overall: N/10** and a hire / lean hire / lean no / no call.
- Per-step score (Requirements, Entities, API, HLD, Deep dives) out of 5, one line each.
- **Top 3 fixes** that would most improve the outcome.
- **Patterns** this problem tests and whether the candidate recognized each.
Under 400 words.`;
  return streamText(prompt, h, "high");
}

export function draftReference(p: Problem, step: StepDef, h: StreamHandlers) {
  const prompt = `${problemHeader(p)}
Patterns it tests: ${p.patterns.join(", ")}.

Write the reference answer for the **${step.title}** step only. ${step.guide}
${step.id === "deepDives" ? "Pick the 3 deep dives that matter most. For each: the question, 2-3 options with tradeoffs, and the recommended approach." : ""}
Be concrete and compact (under 350 words). Markdown.`;
  return streamText(prompt, h, "medium");
}
