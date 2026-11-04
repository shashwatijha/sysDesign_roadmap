import { useEffect, useMemo, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { getBoard, saveBoard } from "../lib/progress";

type Elements = readonly unknown[];

/** Excalidraw canvas whose elements are saved per problem in SQLite. Loaded lazily. */
export default function Whiteboard({ problemId }: { problemId: string }) {
  const initial = useMemo(() => {
    const raw = getBoard(problemId);
    if (!raw) return undefined;
    try {
      return { elements: JSON.parse(raw) as Elements, appState: { viewBackgroundColor: "#ffffff" } };
    } catch {
      return undefined;
    }
  }, [problemId]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef<string>("");
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="h-[620px] overflow-hidden rounded-xl border border-line">
      <Excalidraw
        theme="dark"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialData={(initial ?? { appState: { viewBackgroundColor: "#ffffff" } }) as any}
        onChange={(elements) => {
          const live = elements.filter((e) => !e.isDeleted);
          const json = JSON.stringify(live);
          if (json === last.current) return;
          last.current = json;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => saveBoard(problemId, json), 800);
        }}
      />
    </div>
  );
}
