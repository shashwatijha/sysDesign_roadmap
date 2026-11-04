import initSqlJs, { type Database, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

/**
 * SQLite (sql.js / WASM) running in the browser. The whole DB file is
 * persisted to IndexedDB after every write, and can be exported/imported
 * as a real .sqlite file from Settings.
 */

const IDB_NAME = "sysdesign-daily";
const IDB_STORE = "db";
const IDB_KEY = "main";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS problem_progress (
  problem_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'todo',      -- todo | started | done
  started_at TEXT, completed_at TEXT,
  confidence INTEGER                         -- 1..3 self-rating at completion
);
CREATE TABLE IF NOT EXISTS answers (
  problem_id TEXT NOT NULL, step TEXT NOT NULL, content TEXT NOT NULL,
  updated_at TEXT NOT NULL, PRIMARY KEY (problem_id, step)
);
CREATE TABLE IF NOT EXISTS boards (
  problem_id TEXT PRIMARY KEY, scene TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS item_done (       -- concepts and patterns read
  item_id TEXT PRIMARY KEY, done_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (        -- append-only log, drives streak + heatmap
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_day ON activity(day);
CREATE TABLE IF NOT EXISTS drill_state (
  drill_id TEXT PRIMARY KEY,
  reps INTEGER NOT NULL DEFAULT 0, ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL,
  lapses INTEGER NOT NULL DEFAULT 0, last_correct INTEGER
);
CREATE TABLE IF NOT EXISTS ai_feedback (
  problem_id TEXT NOT NULL, step TEXT NOT NULL, content TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (problem_id, step)
);
CREATE TABLE IF NOT EXISTS generated_refs (  -- Claude-drafted references for stub problems
  problem_id TEXT NOT NULL, step TEXT NOT NULL, content TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (problem_id, step)
);
`;

let db: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
let version = 0;

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<Uint8Array | undefined> {
  try {
    const d = await idb();
    return await new Promise((resolve, reject) => {
      const r = d.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY);
      r.onsuccess = () => resolve(r.result as Uint8Array | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

async function idbPut(bytes: Uint8Array): Promise<void> {
  const d = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function openDb(): Promise<Database> {
  if (db) return db;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await idbGet();
  db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.exec(SCHEMA);
  return db;
}

function flush() {
  if (!db) return;
  const bytes = db.export();
  idbPut(bytes).catch((e) => console.error("persist failed", e));
}

function changed() {
  version++;
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (saveTimer) flush();
  });
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getVersion = () => version;

function need(): Database {
  if (!db) throw new Error("DB not open");
  return db;
}

export function all<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = need().prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export function one<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T | undefined {
  return all<T>(sql, params)[0];
}

export function run(sql: string, params: SqlValue[] = []) {
  need().run(sql, params);
  changed();
}

export function exportBytes(): Uint8Array {
  return need().export();
}

export async function importBytes(bytes: Uint8Array) {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const next = new SQL.Database(bytes);
  next.exec(SCHEMA); // validates + migrates older files
  db?.close();
  db = next;
  await idbPut(db.export());
  changed();
}

export async function resetDb() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  db?.close();
  db = new SQL.Database();
  db.exec(SCHEMA);
  await idbPut(db.export());
  changed();
}
