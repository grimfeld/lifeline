import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router";
import { Toaster } from "@lifeline/ui";
import { HANDOFF_DONE_PATH, HANDOFF_PATH } from "@lifeline/handoff";
import {
  MODULES,
  appById,
  backgroundApps,
  ensureDefaultWorkspace,
  frames,
  isDemo,
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
import { PushProvider } from "./surfaces/push";
import { UserScreenPage } from "./screens/UserScreenPage";
import { ScreensIndex } from "./screens/ScreensIndex";
import { BasePage } from "./bases/BasePage";
import { BasesIndex } from "./bases/BasesIndex";
import { MobileNav } from "./mobile/MobileNav";
import { PhoneHeader } from "./mobile/PhoneHeader";
import { SettingsPage } from "./settings/SettingsPage";
import { KeysPage } from "./settings/KeysPage";
import { KeyBindingHost } from "./keys/KeyBindingHost";
import { GuidePage } from "./guide/GuidePage";
import { ModulePage } from "./modules/ModulePage";
import { FrameLayout, ModuleLayout } from "./modules/ModuleLayout";
import { FALLBACK_PLACE, lastPlace, useResume } from "./nav/resume";
import { PeekHost } from "./peek/PeekHost";
import { SelectionMenu } from "./intake/SelectionMenu";
import { HandoffPage, HandoffSaved } from "./handoff/HandoffPage";
import { DemoBanner, DemoFilling } from "./demo/DemoBanner";

// The heavier Surfaces load when first visited, not with the shell (CR-23).
const MapPage = lazy(() => import("./surfaces/MapPage").then((m) => ({ default: m.MapPage })));
const GraphPage = lazy(() => import("./surfaces/GraphPage").then((m) => ({ default: m.GraphPage })));

/** `/` resumes the last place this device stood in this Workspace (ADR 0057). */
function ResumeRedirect() {
  const workspaceId = useCurrentWorkspaceId();
  return <Navigate to={lastPlace(workspaceId)} replace />;
}

/** The Journal left the Vault for its own interface (ADR 0068): an old link lands on the same day. */
function LegacyJournalRedirect() {
  const [params] = useSearchParams();
  const d = params.get("d");
  return <Navigate to={`/app/journal${d ? `?d=${d}` : ""}`} replace />;
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

/** A Core destination — a general Surface, the Bases, Screens, Settings, the Guide: no chrome but the Rail's. */
function CorePage({ children }: { children: ReactNode }) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <Suspense fallback={null}>{children}</Suspense>
    </main>
  );
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
            element={moduleId ? <ModuleLayout moduleId={moduleId} bare>{routes}</ModuleLayout> : f.sidebar ? <FrameLayout frame={f} bare>{routes}</FrameLayout> : <CorePage>{routes}</CorePage>}
          />
        );
      })}
      <Route path="/vault/journal" element={<LegacyJournalRedirect />} />
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
      <Route path="/settings/keys" element={<CorePage><KeysPage /></CorePage>} />
      <Route path="/guide/:page?" element={<CorePage><GuidePage /></CorePage>} />
      <Route path={HANDOFF_PATH} element={<CorePage><HandoffPage /></CorePage>} />
      <Route path={HANDOFF_DONE_PATH} element={<CorePage><HandoffSaved /></CorePage>} />
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
      {/* Not `/`: the unknown path was just remembered as the last place, and resuming it would loop. */}
      <Route path="*" element={<Navigate to={FALLBACK_PLACE} replace />} />
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
        {/* Above everything, the Phone header included: ADR 0064 keeps banners at the top. */}
        {isDemo() && <DemoBanner />}
        {isDemo() && <DemoFilling />}
        <PhoneHeader />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Rail className="max-md:hidden" />
          <Places />
        </div>
        <MobileNav />
        <CommandPalette />
        <KeyBindingHost />
        <PeekHost />
        <SelectionMenu />
        <PrivateDialogs />
        {/* The Demo never signs in (ADR 0077): no sign-in, no signed-out notice, no account switch. */}
        {!isDemo() && <AccountDialogs />}
        <Toaster position="bottom-right" />
      </div>
    </PushProvider>
  );
}
