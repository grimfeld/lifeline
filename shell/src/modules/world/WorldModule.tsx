import { Navigate } from "react-router";
import { Home, MapPin, Users } from "lucide-react";
import { handModule } from "../handModule";

/** Home: World opens on the People screen, the way the Journal opens on today (ADR 0135). */
function WorldHome() {
  return <Navigate to="/app/people" replace />;
}

/**
 * World (ADR 0128, ADR 0135): the People Module retitled, Contacts and Atlas
 * side by side. It opens on People; the Pins of Places and homes are on the Map.
 */
export const worldShell = handModule({
  id: "people",
  title: "World",
  places: [
    { key: "people", title: "People", icon: Users, screen: "contacts.people" },
    { key: "households", title: "Households", icon: Home, screen: "contacts.households" },
    { key: "places", title: "Places", icon: MapPin, screen: "atlas.places" },
  ],
  pages: [{ path: "", component: WorldHome }],
});
