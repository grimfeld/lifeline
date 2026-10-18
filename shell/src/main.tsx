import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { initApps, isDemo, setTypeIconResolver, startSync } from "@lifeline/core";
import { typeIcon } from "@lifeline/ui";
import { choresApp } from "@lifeline/app-chores";
import { tasksApp } from "@lifeline/app-tasks";
import { projectsApp } from "@lifeline/app-projects";
import { calendarApp } from "@lifeline/app-calendar";
import { sourcesApp } from "@lifeline/app-sources";
import { statsApp } from "@lifeline/app-stats";
import { lifelevelApp } from "@lifeline/app-lifelevel";
import { libraryApp } from "@lifeline/app-library";
import { cinemaApp } from "@lifeline/app-cinema";
import { discothequeApp } from "@lifeline/app-discotheque";
import { arcadeApp } from "@lifeline/app-arcade";
import { commonplaceApp } from "@lifeline/app-commonplace";
import { museumApp } from "@lifeline/app-museum";
import { notesApp } from "@lifeline/app-notes";
import { writerApp } from "@lifeline/app-writer";
import { workoutApp } from "@lifeline/app-workout";
import { ledgerApp } from "@lifeline/app-ledger";
import { pocketApp } from "@lifeline/app-pocket";
import { swearjarApp } from "@lifeline/app-swearjar";
import { knowledgeApp } from "@lifeline/app-languages";
import { pantryApp } from "@lifeline/app-pantry";
import { shoppingApp } from "@lifeline/app-shopping";
import { moodApp } from "@lifeline/app-mood";
import { thoughtsApp } from "@lifeline/app-thoughts";
import { manuscriptApp } from "@lifeline/app-manuscript";
import { mailApp } from "@lifeline/app-mail";
import { pricesApp } from "@lifeline/app-prices";
import { hubApp } from "./hub";
import App from "./App";
import "./index.css";

// Compile-time App registry (ADR 0003): every App joins here. The Demo
// (ADR 0077) leaves out the Apps that need a server: Mail reads Gmail through it.
const SERVER_APPS = new Set([mailApp.id]);
setTypeIconResolver(typeIcon);
initApps(
  [hubApp, choresApp, pantryApp, shoppingApp, tasksApp, projectsApp, calendarApp, statsApp, lifelevelApp, libraryApp, cinemaApp, discothequeApp, arcadeApp, commonplaceApp, museumApp, notesApp, thoughtsApp, writerApp, manuscriptApp, sourcesApp, workoutApp, ledgerApp, pocketApp, pricesApp, moodApp, mailApp, swearjarApp, knowledgeApp].filter(
    (a) => !isDemo() || !SERVER_APPS.has(a.id),
  ),
);
startSync();

const root = ReactDOM.createRoot(document.getElementById("root")!);
const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if (isDemo()) {
  // The Demo life is written before the first screen, so it opens lived-in (ADR 0077).
  root.render(
    <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm" role="status">
      Loading…
    </div>,
  );
  // A chunk of its own: the real build never loads the Demo life.
  void import("./demo/seed")
    .then((m) => m.seedDemoIfNeeded())
    .catch((e) => console.error("Demo life could not be seeded", e))
    .then(() => root.render(app));
} else {
  root.render(app);
}
