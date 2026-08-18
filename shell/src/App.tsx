import { Navigate, Route, Routes, useParams } from "react-router";
import { Toaster } from "@lifeline/ui";
import { db, screenRoute, screensOf, useLiveQuery, workspaces, type UserScreen } from "@lifeline/core";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { CalendarPage } from "./surfaces/CalendarPage";
import { WeekPage } from "./surfaces/WeekPage";
import { MapPage } from "./surfaces/MapPage";
import { SchedulePage } from "./surfaces/SchedulePage";
import { UserScreenPage } from "./screens/UserScreenPage";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { useWorkspaceMemory } from "./components/WorkspaceSwitcher";

function HomeRedirect() {
  const screens = useLiveQuery(
    () => db().collection<UserScreen>("screens").where("deleted").equals(0).sortBy("sort"),
    [],
    undefined,
  );
  if (screens === undefined) return null; // still loading
  if (screens.length > 0) return <Navigate to={`/screen/${screens[0].id}`} replace />;
  return <Navigate to="/calendar" replace />;
}

function LegacyNoteRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/notes/n/${id}`} replace />;
}

/** The built-in Dashboard workspace: user Screens, Surfaces and the Apps' dashboard screens. */
function DashboardWorkspace() {
  return (
    <>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/screen/:id" element={<UserScreenPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          {screensOf().map((s) => {
            const Component = s.component;
            return <Route key={s.id} path={`/app/${s.path}`} element={<Component />} />;
          })}
          {/* Legacy Notes URLs from before the workspace split. */}
          <Route path="/app/notes" element={<Navigate to="/notes" replace />} />
          <Route path="/app/notes/:id" element={<LegacyNoteRedirect />} />
          {/* Screens that moved to another workspace keep their old /app/ URLs as redirects. */}
          {workspaces()
            .flatMap((w) => screensOf(w.id))
            .map((s) => (
              <Route key={`redirect-${s.id}`} path={`/app/${s.path}`} element={<Navigate to={screenRoute(s)} replace />} />
            ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  useWorkspaceMemory();
  return (
    <div className="bg-background text-foreground flex h-dvh overflow-hidden">
      <Routes>
        {workspaces().map((w) => (
          <Route key={w.id} path={`${w.path}/*`} element={<WorkspaceLayout workspace={w} />} />
        ))}
        <Route path="/*" element={<DashboardWorkspace />} />
      </Routes>
      <CommandPalette />
      <Toaster position="bottom-right" />
    </div>
  );
}
