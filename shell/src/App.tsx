import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router";
import { Toaster } from "@lifeline/ui";
import {
  MODULES,
  appById,
  backgroundApps,
  ensureDefaultWorkspace,
  frames,
  screenRoute,
  screensOf,
  useCurrentWorkspaceId,
  useSyncState,
  type AppManifest,
  type FrameDef,
} from "@lifeline/core";
import { Rail } from "./components/Rail";
import { CommandPalette } from "./components/CommandPalette";
import { AccountDialogs } from "./components/AccountDialogs";
import { PrivateDialogs } from "./vault/PrivateDialogs";
import { CalendarPage } from "./surfaces/CalendarSurface";
import { MapPage } from "./surfaces/MapPage";
import { GraphPage } from "./surfaces/GraphPage";
import { PushProvider } from "./surfaces/push";
import { UserScreenPage } from "./screens/UserScreenPage";
import { ScreensIndex } from "./screens/ScreensIndex";
import { BasePage } from "./bases/BasePage";
import { BasesIndex } from "./bases/BasesIndex";
import { MobileNav } from "./mobile/MobileNav";
import { PhoneHeader } from "./mobile/PhoneHeader";
import { SettingsPage } from "./settings/SettingsPage";
import { ModulePage } from "./modules/ModulePage";
import { ModuleLayout } from "./modules/ModuleLayout";
import { lastPlace, useResume } from "./nav/resume";
import { PeekHost } from "./peek/PeekHost";

/** `/` resumes the last place this device stood in this Workspace (ADR 0057). */
function ResumeRedirect() {
  const workspaceId = useCurrentWorkspaceId();
  return <Navigate to={lastPlace(workspaceId)} replace />;
}

function LegacyNoteRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/vault/d/${id}`} replace />;
}

function LegacyVaultRedirect() {
  const { "*": rest } = useParams();
  return <Navigate to={`/vault/${rest ?? ""}`.replace("/vault/n/", "/vault/d/")} replace />;
}

/**
 * The Week planner and the Schedule are views of the Calendar now (ADR 0063):
 * an old link lands on the matching view, the day kept.
 */
function LegacyTimeRedirect({ view }: { view: "week" | "schedule" }) {
  const [params] = useSearchParams();
  const d = params.get("d");
  const to = view === "week" || params.get("view") === "week" ? "week" : "day";
  return <Navigate to={`/calendar?view=${to}${d ? `&d=${d}` : ""}`} replace />;
}

/** A Core destination — a general Surface, the Bases, Screens, Settings: no chrome but the Rail's. */
function CorePage({ children }: { children: ReactNode }) {
  return <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>;
}

/** The routes of a hand-written Module layout (the Vault), below its path. */
function FrameRoutes({ frame }: { frame: FrameDef }) {
  return (
    <Routes>
      {frame.home && <Route index element={<Navigate to={frame.home} replace />} />}
      {screensOf(frame.id).map((s) => {
        const Component = s.component;
        return <Route key={s.id} path={s.path || "/"} element={<Component />} />;
      })}
      <Route path="*" element={<Navigate to={frame.home || "."} replace />} />
    </Routes>
  );
}

/** The Module whose layout a frame is — the one whose home is the frame's path. */
function moduleOfFrame(frame: FrameDef): string | undefined {
  return MODULES.find((m) => m.home === frame.path)?.id;
}

/**
 * Every place, beside the Rail (ADR 0057): Modules, each in its own layout,
 * and Core's destinations with no chrome but the Rail. An App screen is shown
 * inside its App's Module; one whose App names no Module (the Calendar App's
 * Events) is shown bare, reached from the palette.
 */
function Places() {
  return (
    <Routes>
      <Route path="/" element={<ResumeRedirect />} />
      {frames().map((f) => {
        const moduleId = moduleOfFrame(f);
        const routes = <FrameRoutes frame={f} />;
        return (
          <Route
            key={f.id}
            path={`${f.path}/*`}
            element={moduleId ? <ModuleLayout moduleId={moduleId} bare>{routes}</ModuleLayout> : <CorePage>{routes}</CorePage>}
          />
        );
      })}
      <Route path="/module/:id/*" element={<ModulePage />} />
      {screensOf().map((s) => {
        const Component = s.component;
        const moduleId = appById(s.appId)?.module;
        const known = moduleId && MODULES.some((m) => m.id === moduleId);
        return (
          <Route
            key={s.id}
            path={`/app/${s.path}`}
            element={known ? <ModuleLayout moduleId={moduleId}><Component /></ModuleLayout> : <CorePage><Component /></CorePage>}
          />
        );
      })}
      <Route path="/calendar" element={<CorePage><CalendarPage /></CorePage>} />
      <Route path="/week" element={<LegacyTimeRedirect view="week" />} />
      <Route path="/schedule" element={<LegacyTimeRedirect view="schedule" />} />
      <Route path="/map" element={<CorePage><MapPage /></CorePage>} />
      <Route path="/graph" element={<CorePage><GraphPage /></CorePage>} />
      <Route path="/base" element={<CorePage><BasesIndex /></CorePage>} />
      <Route path="/base/:type" element={<CorePage><BasePage /></CorePage>} />
      <Route path="/screens" element={<CorePage><ScreensIndex /></CorePage>} />
      <Route path="/screen/:id" element={<CorePage><UserScreenPage /></CorePage>} />
      <Route path="/settings" element={<CorePage><SettingsPage /></CorePage>} />
      {/* Legacy Notes URLs (before the frame split, and before the Vault rename). */}
      <Route path="/app/notes" element={<Navigate to="/vault" replace />} />
      <Route path="/app/notes/:id" element={<LegacyNoteRedirect />} />
      <Route path="/notes/*" element={<LegacyVaultRedirect />} />
      {/* Screens that moved into the Vault keep their old /app/ URLs as redirects. */}
      {frames()
        .flatMap((w) => screensOf(w.id))
        .map((s) => (
          <Route key={`redirect-${s.id}`} path={`/app/${s.path}`} element={<Navigate to={screenRoute(s)} replace />} />
        ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** One component per App with a background hook, so each hook runs under React's rules (ADR 0032). */
function AppBackground({ app }: { app: AppManifest }) {
  app.useBackground!();
  return null;
}

export default function App() {
  useResume();
  // A genuinely empty account makes its one Workspace here; an existing one was
  // given it by the server (PocketBase migration 1757400000), and this waits
  // for the first full pull rather than racing it into a second "Personal"
  // (ADR 0047). Keyed on the sync state so it runs again the moment that pull
  // lands — nothing else re-renders when a cycle finishes.
  const { state: syncState } = useSyncState();
  useEffect(() => {
    void ensureDefaultWorkspace();
  }, [syncState]);
  return (
    <PushProvider>
      <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
        {backgroundApps().map((a) => (
          <AppBackground key={a.id} app={a} />
        ))}
        <PhoneHeader />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Rail className="max-md:hidden" />
          <Places />
        </div>
        <MobileNav />
        <CommandPalette />
        <PeekHost />
        <PrivateDialogs />
        <AccountDialogs />
        <Toaster position="bottom-right" />
      </div>
    </PushProvider>
  );
}
