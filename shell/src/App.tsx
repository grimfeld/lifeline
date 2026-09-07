import { Navigate, Route, Routes, useParams } from "react-router";
import { Toaster } from "@lifeline/ui";
import { backgroundApps, db, screenRoute, screensOf, useLiveQuery, frames, type AppManifest, type UserScreen } from "@lifeline/core";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { PrivateDialogs } from "./vault/PrivateDialogs";
import { CalendarPage } from "./surfaces/CalendarPage";
import { WeekPage } from "./surfaces/WeekPage";
import { MapPage } from "./surfaces/MapPage";
import { GraphPage } from "./surfaces/GraphPage";
import { SchedulePage } from "./surfaces/SchedulePage";
import { UserScreenPage } from "./screens/UserScreenPage";
import { BasePage } from "./bases/BasePage";
import { BasesIndex } from "./bases/BasesIndex";
import { FrameLayout } from "./components/FrameLayout";
import { useFrameMemory } from "./components/FrameSwitcher";
import { MobileNav } from "./mobile/MobileNav";
import { PhoneHomePage } from "./mobile/PhoneHomePage";

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
  return <Navigate to={`/vault/d/${id}`} replace />;
}

function LegacyVaultRedirect() {
  const { "*": rest } = useParams();
  return <Navigate to={`/vault/${rest ?? ""}`.replace("/vault/n/", "/vault/d/")} replace />;
}

/** The built-in Dashboard frame: user Screens, Surfaces and the Apps' dashboard screens. */
function DashboardFrame() {
  return (
    <>
      <Sidebar className="max-md:hidden" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/screen/:id" element={<UserScreenPage />} />
          <Route path="/phone" element={<PhoneHomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/base" element={<BasesIndex />} />
          <Route path="/base/:type" element={<BasePage />} />
          {screensOf().map((s) => {
            const Component = s.component;
            return <Route key={s.id} path={`/app/${s.path}`} element={<Component />} />;
          })}
          {/* Legacy Notes URLs (before the frame split, and before the Vault rename). */}
          <Route path="/app/notes" element={<Navigate to="/vault" replace />} />
          <Route path="/app/notes/:id" element={<LegacyNoteRedirect />} />
          <Route path="/notes/*" element={<LegacyVaultRedirect />} />
          {/* Screens that moved to another frame keep their old /app/ URLs as redirects. */}
          {frames()
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

/** One component per App with a background hook, so each hook runs under React's rules (ADR 0032). */
function AppBackground({ app }: { app: AppManifest }) {
  app.useBackground!();
  return null;
}

export default function App() {
  useFrameMemory();
  return (
    <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
      {backgroundApps().map((a) => (
        <AppBackground key={a.id} app={a} />
      ))}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Routes>
          {frames().map((w) => (
            <Route key={w.id} path={`${w.path}/*`} element={<FrameLayout frame={w} />} />
          ))}
          <Route path="/*" element={<DashboardFrame />} />
        </Routes>
      </div>
      <MobileNav />
      <CommandPalette />
      <PrivateDialogs />
      <Toaster position="bottom-right" />
    </div>
  );
}
