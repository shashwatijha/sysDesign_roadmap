# SysDev

A local-first web app for practicing system design one problem a day.

- **Roadmap**: a dependency graph from the interview framework through core concepts and patterns to easy, medium and hard problems. Each node shows its progress.
- **Problems** follow a 5-step delivery framework (Requirements → Core Entities → API → High-Level Design → Deep Dives). Each step has a timer budget, hints, an answer box that saves as you type, and a reference answer you reveal after you write yours. Every problem has an Excalidraw whiteboard.
- **Pattern check**: before you start a problem, guess which patterns it tests.
- **Pattern drills**: short scenarios where you pick the patterns that apply. Spaced repetition brings misses back the next day.
- **Streak**: a day counts when you finish at least one problem. One missed day per week is forgiven automatically. Includes a GitHub-style heatmap.
- **Claude feedback** (optional): per-step critique, a full mock-interview grade, and drafted references for stub problems. It uses your own API key.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Data

All progress is stored in a **SQLite database (sql.js/WASM) inside your browser**, persisted to IndexedDB. Use **Settings → Export .sqlite** to back it up or move it to another machine, and **Import** to restore it. Clearing the site data in your browser deletes your progress, so export now and then.

The Anthropic API key is stored only in your browser's localStorage. It is never written to the database file, and requests go straight from your browser to `api.anthropic.com`.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds and deploys on every push to `main`. Enable it once in **Repo Settings → Pages → Source: GitHub Actions**. The site lives at `https://<user>.github.io/<repo>/`. Progress is stored per browser and per origin, so localhost and the Pages site keep separate data. Use export/import to move between them.

## Adding content

| What | Where |
|---|---|
| Roadmap nodes and edges | `src/data/roadmap.ts` |
| Concepts | `src/data/concepts.ts` |
| Patterns | `src/data/patterns.ts` |
| Problems (full references) | `src/data/problems/{easy,medium,hard}.ts` |
| Stub problems (Claude drafts references) | `src/data/problems/index.ts` |
| Drills | `src/data/drills.ts` |

The structure of the content is inspired by common interview prep frameworks. All text is original.
