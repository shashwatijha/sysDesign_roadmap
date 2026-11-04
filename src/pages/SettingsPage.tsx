import { useRef, useState } from "react";
import { MODELS, getApiKey, getModel, setApiKey, setModel } from "../lib/ai";
import { exportBytes, importBytes, resetDb } from "../lib/db";
import { dayKey } from "../lib/progress";

export default function SettingsPage() {
  const [key, setKey] = useState(getApiKey());
  const [model, setM] = useState(getModel());
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const download = () => {
    const bytes = exportBytes();
    const blob = new Blob([bytes.slice().buffer], { type: "application/vnd.sqlite3" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sysdesign-${dayKey()}.sqlite`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (f: File) => {
    try {
      await importBytes(new Uint8Array(await f.arrayBuffer()));
      setMsg("Imported. Your progress was replaced with the file's contents.");
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Claude feedback</h2>
        <p className="text-sm text-mute">
          Your key is stored only in this browser (localStorage) and sent directly to api.anthropic.com.
          It is not saved in the database file, so exports are safe to share. Get one at console.anthropic.com.
        </p>
        <label className="block text-sm">
          API key
          <input
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setSaved(false); }}
            placeholder="sk-ant-…"
            className="mt-1 w-full rounded-md border border-line bg-[#0f1012] px-3 py-2 font-mono text-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          Model
          <select
            value={model}
            onChange={(e) => { setM(e.target.value); setSaved(false); }}
            className="mt-1 w-full rounded-md border border-line bg-[#0f1012] px-3 py-2 text-sm"
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={() => { setApiKey(key); setModel(model); setSaved(true); }}>Save</button>
          {key && <button className="btn" onClick={() => { setKey(""); setApiKey(""); setSaved(true); }}>Remove key</button>}
          {saved && <span className="text-sm text-ok">Saved</span>}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Your data</h2>
        <p className="text-sm text-mute">
          Progress, answers, whiteboards and drill history live in a SQLite database inside this browser (IndexedDB).
          Clearing site data deletes it, so export a backup now and then, or to move to another machine.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={download}>Export .sqlite</button>
          <button className="btn" onClick={() => file.current?.click()}>Import .sqlite</button>
          <input ref={file} type="file" accept=".sqlite,.db,application/octet-stream" className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button
            className="btn ml-auto border-rose-500/40 text-rose-300"
            onClick={async () => {
              if (confirm("Delete all progress, answers and streak? Export first if unsure.")) {
                await resetDb();
                setMsg("All local data cleared.");
              }
            }}
          >
            Reset everything
          </button>
        </div>
        {msg && <p className="text-sm text-mute">{msg}</p>}
      </section>
    </main>
  );
}
