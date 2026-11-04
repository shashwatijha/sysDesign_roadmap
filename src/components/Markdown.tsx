import { useMemo } from "react";
import { Marked } from "marked";

const md = new Marked({ gfm: true, breaks: false });
// Raw HTML in markdown (including Claude output) is shown as text, never rendered.
md.use({
  renderer: {
    html({ text }) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
  },
});

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(() => md.parse(text.trim()) as string, [text]);
  return (
    <div
      className={`prose prose-invert prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-li:my-0.5 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
