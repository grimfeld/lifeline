import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "@lifeline/ui";
import { db, registeredApps, useLiveQuery, type UserScreen } from "@lifeline/core";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { CalendarPage } from "./surfaces/CalendarPage";
import { WeekPage } from "./surfaces/WeekPage";
import { MapPage } from "./surfaces/MapPage";
import { UserScreenPage } from "./screens/UserScreenPage";

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

export default function App() {
  return (
    <div className="bg-background text-foreground flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/screen/:id" element={<UserScreenPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/map" element={<MapPage />} />
          {registeredApps()
            .flatMap((a) => a.screens)
            .map((s) => {
              const Component = s.component;
              return <Route key={s.id} path={`/app/${s.path}`} element={<Component />} />;
            })}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <CommandPalette />
      <Toaster position="bottom-right" />
    </div>
  );
}
