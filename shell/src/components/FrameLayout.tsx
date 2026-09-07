import { Navigate, Route, Routes } from "react-router";
import { screensOf, type FrameDef } from "@lifeline/core";
import { FrameSwitcher } from "./FrameSwitcher";
import { SyncBadge } from "./SyncBadge";

/**
 * Frame for an App-provided frame (ADR 0012): Core's switcher above the
 * frame's own sidebar, and the frame's screens routed below its path.
 */
export function FrameLayout({ frame }: { frame: FrameDef }) {
  const Sidebar = frame.sidebar;
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground flex w-72 shrink-0 flex-col border-r max-md:hidden">
        <FrameSwitcher />
        <div className="flex min-h-0 flex-1 flex-col">
          <Sidebar />
        </div>
        <div className="border-t p-2">
          <SyncBadge />
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">
        <Routes>
          {frame.home && <Route index element={<Navigate to={frame.home} replace />} />}
          {screensOf(frame.id).map((s) => {
            const Component = s.component;
            return <Route key={s.id} path={s.path || "/"} element={<Component />} />;
          })}
          <Route path="*" element={<Navigate to={frame.home || "."} replace />} />
        </Routes>
      </main>
    </>
  );
}
