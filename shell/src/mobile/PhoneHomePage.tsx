import { Navigate, useNavigate } from "react-router";
import { Button } from "@lifeline/ui";
import { db, useLiveQuery, type UserScreen } from "@lifeline/core";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { createStarterPhoneHome, setPhoneHome, usePhoneHome } from "./phoneHome";

/** /phone: redirect to the phone-home Screen, or pick one (grill 2026-08-20). */
export function PhoneHomePage() {
  const home = usePhoneHome();
  const navigate = useNavigate();
  const screens = useLiveQuery(
    () => db().collection<UserScreen>("screens").where("deleted").equals(0).sortBy("sort"),
    [],
    [] as UserScreen[],
  );

  if (home) return <Navigate to={`/screen/${home.id}`} replace />;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 p-6">
      <h1 className="text-lg font-semibold">Pick a phone home</h1>
      <p className="text-muted-foreground text-sm">The Screen the phone's Home tab opens. Set it any time from a Screen's context menu in the sidebar.</p>
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
          void createStarterPhoneHome(screens.length).then((id) => navigate(`/screen/${id}`));
        }}
      >
        <Sparkles /> Create a starter phone home
      </Button>
    </div>
  );
}
