import { lazy, Suspense, useMemo } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useDbVersion } from "./lib/useDb";
import { computeStreak } from "./lib/progress";
import RoadmapPage from "./pages/RoadmapPage";
import NodePage from "./pages/NodePage";
import LearnPage from "./pages/LearnPage";
import DrillsPage from "./pages/DrillsPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import { Flame } from "./components/bits";

const ProblemPage = lazy(() => import("./pages/ProblemPage"));

function Nav() {
  const v = useDbVersion();
  const streak = useMemo(() => computeStreak(), [v]);
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm ${isActive ? "bg-panel2 text-ink" : "text-mute hover:text-ink"}`;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <NavLink to="/" className="mr-3 flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500 text-xs font-bold text-emerald-950">SD</span>
          <span className="hidden sm:inline">SysDesign Daily</span>
        </NavLink>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          <NavLink to="/" end className={link}>Roadmap</NavLink>
          <NavLink to="/drills" className={link}>Drills</NavLink>
          <NavLink to="/progress" className={link}>Progress</NavLink>
          <NavLink to="/settings" className={link}>Settings</NavLink>
        </nav>
        <NavLink
          to="/progress"
          title={streak.todayDone ? "Today counted" : "Finish a problem today to keep the streak"}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${
            streak.todayDone ? "border-orange-400/50 bg-orange-500/15 text-orange-300" : "border-line text-mute"
          }`}
        >
          <Flame lit={streak.todayDone} /> {streak.current}
        </NavLink>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-full">
      <Nav />
      <Suspense fallback={<div className="p-8 text-mute">Loading…</div>}>
        <Routes>
          <Route path="/" element={<RoadmapPage />} />
          <Route path="/node/:id" element={<NodePage />} />
          <Route path="/learn/:id" element={<LearnPage />} />
          <Route path="/problem/:id" element={<ProblemPage />} />
          <Route path="/drills" element={<DrillsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<div className="p-8 text-mute">Not found.</div>} />
        </Routes>
      </Suspense>
    </div>
  );
}
