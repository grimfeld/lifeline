import { Navigate, useNavigate } from "react-router";
import { Button } from "@lifeline/ui";
import { useCurrentWorkspace, useWorkspaceScreens } from "@lifeline/core";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { createStarterPhoneHome, setPhoneHome, usePhoneHome } from "./phoneHome";

/** /phone: redirect to this Workspace's phone-home Screen, or pick one (ADR 0021, amended). */
export function PhoneHomePage() {
  const home = usePhoneHome();
  const navigate = useNavigate();
  const screens = useWorkspaceScreens();
  const ws = useCurrentWorkspace();

  if (home) return <Navigate to={`/screen/${home.id}`} replace />;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 p-6">
      <h1 className="text-lg font-semibold">Pick a phone home</h1>
      <p className="text-muted-foreground text-sm">The Screen this Workspace's Home tab opens. Each Workspace has its own; set it any time from a Screen's context menu in the sidebar.</p>
      {screens.map((s) => (
        <Button
          key={s.id}
          variant="outline"
          className="justify-start"
          onClick={() => {
            void setPhoneHome(s.id).then(() => navigate(`/screen/${s.id}`));
          }}
        >
          <LayoutDashboard /> {s.name}
        </Button>
      ))}
      <Button
        onClick={() => {
          if (ws) void createStarterPhoneHome(screens.length, ws.id).then((id) => navigate(`/screen/${id}`));
        }}
      >
        <Sparkles /> Create a starter phone home
      </Button>
    </div>
  );
}
