import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PROBLEM_BY_ID } from "../data/problems";
import { PATTERNS } from "../data/patterns";
import { STEPS } from "../data/roadmap";
import type { Problem, StepDef, StepId } from "../data/types";
import { Markdown } from "../components/Markdown";
import { ConceptChip, DifficultyChip, PatternChip } from "../components/bits";
import {
  allProblemProgress, getAnswers, getFeedback, getGeneratedRefs, markDone, markStarted, markUndone,
  saveAnswer, saveFeedback, saveGeneratedRef,
} from "../lib/progress";
import { draftReference, feedbackOnStep, fullReview, hasApiKey } from "../lib/ai";
import { useDbVersion } from "../lib/useDb";

const Whiteboard = lazy(() => import("../components/Whiteboard"));

const PATTERN_GUESS = "_patterns";
const FULL_REVIEW = "_review";

function referenceText(p: Problem, step: StepId, generated: Record<string, string>): string | undefined {
  const r = p.reference;
  if (!r) return generated[step];
  if (step === "deepDives") return r.deepDives.map((d) => `### ${d.question}\n${d.answer}`).join("\n\n");
  return r[step];
}

export default function ProblemPage() {
  const { id = "" } = useParams();
  const p = PROBLEM_BY_ID[id];
  if (!p) return <main className="p-8 text-mute">Unknown problem.</main>;
  return <ProblemView key={p.id} p={p} />;
}

function ProblemView({ p }: { p: Problem }) {
  const v = useDbVersion();
  const progress = useMemo(() => allProblemProgress()[p.id], [v, p.id]);
  const feedback = useMemo(() => getFeedback(p.id), [v, p.id]);
  const generated = useMemo(() => getGeneratedRefs(p.id), [v, p.id]);

  const [answers, setAnswers] = useState<Record<string, string>>(() => getAnswers(p.id));
  const [stepIdx, setStepIdx] = useState(0);
  const [showBoard, setShowBoard] = useState(false);
  const step = STEPS[stepIdx];

  // autosave
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const update = (key: string, text: string) => {
    setAnswers((a) => ({ ...a, [key]: text }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      saveAnswer(p.id, key, text);
      if (text.trim() && !progress) markStarted(p.id);
    }, 500);
  };
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const status = progress?.status ?? "todo";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link to={`/node/${p.difficulty}`} className="text-sm text-mute hover:text-ink">← {p.difficulty} problems</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <DifficultyChip d={p.difficulty} />
        {status === "done" && <span className="chip border-emerald-500/50 text-emerald-300">solved</span>}
        <div className="ml-auto"><Timer /></div>
      </div>
      <blockquote className="mt-3 rounded-lg border-l-4 border-emerald-500 bg-panel px-4 py-3 text-[15px]">
        “{p.prompt}”
      </blockquote>

      <PatternGuess p={p} saved={answers[PATTERN_GUESS]} onSave={(s) => update(PATTERN_GUESS, s)} />

      {/* step tabs */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {STEPS.map((s, i) => {
          const filled = !!answers[s.id]?.trim();
          return (
            <button
              key={s.id}
              onClick={() => setStepIdx(i)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm ${
                i === stepIdx ? "border-emerald-400 text-ink" : "border-transparent text-mute hover:text-ink"
              }`}
            >
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${filled ? "bg-emerald-500 text-emerald-950" : "bg-panel2"}`}>
                {filled ? "✓" : i + 1}
              </span>
              {s.title}
              <span className="text-[11px] text-mute">{s.minutes}m</span>
            </button>
          );
        })}
      </div>

      <StepPanel
        key={step.id}
        p={p}
        step={step}
        answers={answers}
        onChange={(t) => update(step.id, t)}
        reference={referenceText(p, step.id, generated)}
        feedback={feedback[step.id]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn" disabled={stepIdx === 0} onClick={() => setStepIdx(stepIdx - 1)}>← Prev</button>
        <button className="btn" disabled={stepIdx === STEPS.length - 1} onClick={() => setStepIdx(stepIdx + 1)}>Next →</button>
        <button className="btn ml-auto" onClick={() => setShowBoard((s) => !s)}>
          {showBoard ? "Hide whiteboard" : "✎ Whiteboard"}
        </button>
      </div>

      {showBoard && (
        <div className="mt-4">
          <Suspense fallback={<div className="card p-6 text-mute">Loading whiteboard…</div>}>
            <Whiteboard problemId={p.id} />
          </Suspense>
        </div>
      )}

      <FullReview p={p} answers={answers} saved={feedback[FULL_REVIEW]} />

      <Completion p={p} status={status} />

      <div className="mt-8 flex flex-wrap gap-1.5 text-xs text-mute">
        Concepts: {p.concepts.map((c) => <ConceptChip key={c} id={c} />)}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function PatternGuess({ p, saved, onSave }: { p: Problem; saved?: string; onSave: (s: string) => void }) {
  const parsed = useMemo(() => {
    try { return saved ? (JSON.parse(saved) as { picks: string[]; checked: boolean }) : null; } catch { return null; }
  }, [saved]);
  const [picks, setPicks] = useState<string[]>(parsed?.picks ?? []);
  const checked = parsed?.checked ?? false;
  const toggle = (id: string) => !checked && setPicks((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const hit = picks.filter((x) => p.patterns.includes(x)).length;

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          Pattern check: <span className="text-mute">which patterns will this problem test?</span>
        </div>
        {checked ? (
          <span className="text-sm text-mute">
            You got {hit}/{p.patterns.length}
            {picks.length > hit ? `, ${picks.length - hit} extra` : ""}
          </span>
        ) : (
          <button className="btn" disabled={!picks.length} onClick={() => onSave(JSON.stringify({ picks, checked: true }))}>
            Check
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PATTERNS.map((pt) => {
          const picked = picks.includes(pt.id);
          const correct = p.patterns.includes(pt.id);
          let cls = picked ? "border-sky-400 bg-sky-500/15 text-sky-200" : "text-mute hover:text-ink";
          if (checked) {
            cls = correct && picked ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
              : correct ? "border-amber-400 text-amber-200"
              : picked ? "border-rose-400/60 text-rose-300 line-through" : "opacity-40";
          }
          return (
            <button key={pt.id} onClick={() => toggle(pt.id)} className={`chip text-[13px] ${cls}`}>
              {pt.title}{checked && correct && !picked ? " (missed)" : ""}
            </button>
          );
        })}
      </div>
      {checked && (
        <div className="mt-2 flex items-center gap-2 text-xs text-mute">
          <span>Tested:</span> {p.patterns.map((x) => <PatternChip key={x} id={x} />)}
          <button className="ml-auto underline" onClick={() => { setPicks([]); onSave(""); }}>retry</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function useStream() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const start = async (fn: (h: { onText: (t: string) => void; signal: AbortSignal }) => Promise<string>, onDone: (t: string) => void) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true); setError(""); setText("");
    try {
      const t = await fn({ onText: setText, signal: c.signal });
      onDone(t);
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { text, busy, error, start, stop: () => ctrl.current?.abort() };
}

function StepPanel({ p, step, answers, onChange, reference, feedback }: {
  p: Problem; step: StepDef; answers: Record<string, string>; onChange: (t: string) => void;
  reference?: string; feedback?: string;
}) {
  const hints = p.hints?.[step.id] ?? [];
  const [hintsShown, setHintsShown] = useState(0);
  const [showRef, setShowRef] = useState(false);
  const fb = useStream();
  const draft = useStream();
  const ai = hasApiKey();
  const value = answers[step.id] ?? "";

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div>
        <Markdown text={step.guide} className="text-mute" />
        {hints.length > 0 && (
          <div className="mt-2 space-y-1">
            {hints.slice(0, hintsShown).map((h) => (
              <div key={h} className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-sm text-amber-100">💡 {h}</div>
            ))}
            {hintsShown < hints.length && (
              <button className="text-xs text-amber-300 hover:underline" onClick={() => setHintsShown(hintsShown + 1)}>
                Show hint ({hints.length - hintsShown} left)
              </button>
            )}
          </div>
        )}
        <textarea
          className="answer mt-3"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDER[step.id]}
          spellCheck={false}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn" onClick={() => setShowRef((s) => !s)}>
            {showRef ? "Hide reference" : "Reveal reference"}
          </button>
          <button
            className="btn"
            disabled={!ai || !value.trim() || fb.busy}
            title={ai ? "" : "Add an API key in Settings"}
            onClick={() => fb.start((h) => feedbackOnStep(p, step, answers, reference, h), (t) => saveFeedback(p.id, step.id, t))}
          >
            {fb.busy ? "Claude is reviewing…" : "✦ Get feedback"}
          </button>
          {fb.busy && <button className="btn" onClick={fb.stop}>Stop</button>}
          {!ai && <Link to="/settings" className="self-center text-xs text-mute underline">Add API key for feedback</Link>}
        </div>
      </div>

      <div className="space-y-4">
        {(fb.text || fb.error || feedback) && (
          <div className="card p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-violet-300">Claude's feedback</div>
            {fb.error ? <p className="text-sm text-bad">{fb.error}</p> : <Markdown text={fb.text || feedback || ""} />}
          </div>
        )}
        {showRef && (
          <div className="card p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Reference {p.reference ? "" : "(drafted by Claude)"}
            </div>
            {step.id === "deepDives" && p.reference ? (
              <div className="space-y-2">
                {p.reference.deepDives.map((d) => (
                  <details key={d.question} className="rounded-lg border border-line bg-panel2 p-3">
                    <summary className="cursor-pointer text-sm font-medium">{d.question}</summary>
                    <Markdown text={d.answer} className="mt-2" />
                  </details>
                ))}
              </div>
            ) : reference || draft.text ? (
              <Markdown text={draft.text || reference || ""} />
            ) : (
              <div className="text-sm text-mute">
                <p>No written reference for this problem yet.</p>
                <button
                  className="btn mt-2"
                  disabled={!ai || draft.busy}
                  onClick={() => draft.start((h) => draftReference(p, step, h), (t) => saveGeneratedRef(p.id, step.id, t))}
                >
                  {draft.busy ? "Drafting…" : "✦ Draft one with Claude"}
                </button>
                {draft.error && <p className="mt-2 text-bad">{draft.error}</p>}
              </div>
            )}
          </div>
        )}
        {!showRef && !fb.text && !feedback && (
          <div className="rounded-xl border border-dashed border-line p-6 text-sm text-mute">
            Write your answer first, then reveal the reference or ask Claude for feedback.
            Comparing after you commit to an answer is what builds the skill.
          </div>
        )}
      </div>
    </div>
  );
}

const PLACEHOLDER: Record<StepId, string> = {
  requirements: "Functional:\n- Users can …\n- Users can …\n\nNon-functional:\n- Scale: …\n- Latency: …\n- Consistency vs availability: …",
  entities: "- User\n- …",
  api: "POST /…   { … } -> { … }\nGET  /…",
  highLevel: "Client -> LB -> Service -> DB\n\nFlow for each API:\n1. …",
  deepDives: "1. <hardest problem>\n   Options: …\n   Choice + tradeoff: …",
};

// ---------------------------------------------------------------------------

function FullReview({ p, answers, saved }: { p: Problem; answers: Record<string, string>; saved?: string }) {
  const s = useStream();
  const filled = STEPS.filter((st) => answers[st.id]?.trim()).length;
  const ai = hasApiKey();
  return (
    <section className="card mt-8 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="font-medium">Mock interview grade</div>
          <div className="text-xs text-mute">Claude grades the whole design as an interviewer would. {filled}/5 steps written.</div>
        </div>
        <button
          className="btn ml-auto"
          disabled={!ai || filled < 3 || s.busy}
          title={!ai ? "Add an API key in Settings" : filled < 3 ? "Write at least 3 steps first" : ""}
          onClick={() => s.start((h) => fullReview(p, answers, h), (t) => saveFeedback(p.id, FULL_REVIEW, t))}
        >
          {s.busy ? "Grading…" : "✦ Grade my design"}
        </button>
      </div>
      {(s.text || saved || s.error) && (
        <div className="mt-3 border-t border-line pt-3">
          {s.error ? <p className="text-sm text-bad">{s.error}</p> : <Markdown text={s.text || saved || ""} />}
        </div>
      )}
    </section>
  );
}

function Completion({ p, status }: { p: Problem; status: string }) {
  if (status === "done") {
    return (
      <section className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <span className="font-medium text-emerald-200">✓ Solved. Counts toward today's streak.</span>
        <button className="btn ml-auto" onClick={() => markUndone(p.id)}>Undo</button>
      </section>
    );
  }
  return (
    <section className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line p-4">
      <span className="mr-2 text-sm">Done? How solid did that feel?</span>
      {[
        { c: 1, label: "Shaky" },
        { c: 2, label: "OK" },
        { c: 3, label: "Solid" },
      ].map((o) => (
        <button key={o.c} className="btn btn-primary" onClick={() => markDone(p.id, o.c)}>
          {o.label}
        </button>
      ))}
    </section>
  );
}

function Timer() {
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const over = secs > 45 * 60;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`font-mono tabular-nums ${over ? "text-bad" : "text-mute"}`}>{mm}:{ss} / 45:00</span>
      <button className="btn py-1" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : secs ? "Resume" : "Start timer"}</button>
      {secs > 0 && !running && <button className="btn py-1" onClick={() => setSecs(0)}>Reset</button>}
    </div>
  );
}
