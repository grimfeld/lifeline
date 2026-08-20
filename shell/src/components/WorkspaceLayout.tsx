import { Navigate, Route, Routes } from "react-router";
import { screensOf, type WorkspaceDef } from "@lifeline/core";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SyncBadge } from "./SyncBadge";

/**
 * Frame for an App-provided workspace (ADR 0012): Core's switcher above the
 * workspace's own sidebar, and the workspace's screens routed below its path.
 */
export function WorkspaceLayout({ workspace }: { workspace: WorkspaceDef }) {
  const Sidebar = workspace.sidebar;
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground flex w-72 shrink-0 flex-col border-r max-md:hidden">
        <WorkspaceSwitcher />
        <div className="flex min-h-0 flex-1 flex-col">
          <Sidebar />
        </div>
        <div className="border-t p-2">
          <SyncBadge />
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">
        <Routes>
          {workspace.home && <Route index element={<Navigate to={workspace.home} replace />} />}
          {screensOf(workspace.id).map((s) => {
            const Component = s.component;
            return <Route key={s.id} path={s.path || "/"} element={<Component />} />;
          })}
          <Route path="*" element={<Navigate to={workspace.home || "."} replace />} />
        </Routes>
      </main>
    </>
  );
}
