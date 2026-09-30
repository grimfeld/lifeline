import { CalendarDays, ClipboardList, Home, ShoppingBasket, ShoppingCart } from "lucide-react";
import { CalendarPage } from "../../surfaces/CalendarPage";
import { ModuleCard } from "../ModuleCard";
import { handModule, ModuleHomeHeader } from "../handModule";

/**
 * House's home: what the house asks of you today. The chores due, the list
 * for the next shop, what is running low and what is about to go off — three
 * Apps' Cards on one page, because they are one errand.
 */
function HouseHome() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <ModuleHomeHeader title="House" />
      <div className="grid gap-4 md:grid-cols-2">
        <ModuleCard cardId="chores.due-today" />
        <ModuleCard cardId="shopping.list" />
        <ModuleCard cardId="pantry.running-low" />
        <ModuleCard cardId="pantry.expiring" />
      </div>
    </div>
  );
}

/**
 * House (ADR 0057). Chores, Pantry and the Shopping list keep their screens;
 * House arranges them, and embeds the Calendar Surface under its own scope —
 * the month of Chores, and nothing else, which is the lens the general
 * Calendar cannot be.
 */
export const houseShell = handModule({
  id: "house",
  title: "House",
  places: [
    { key: "home", title: "Home", icon: Home, page: "" },
    { key: "chores", title: "Chores", icon: ClipboardList, screen: "chores.main" },
    { key: "pantry", title: "Pantry", icon: ShoppingBasket, screen: "pantry.main" },
    { key: "shopping", title: "Shopping", icon: ShoppingCart, screen: "shopping.main" },
    { key: "calendar", title: "Calendar", icon: CalendarDays, page: "calendar" },
  ],
  pages: [
    { path: "", component: HouseHome },
    { path: "calendar", component: CalendarPage },
  ],
});
