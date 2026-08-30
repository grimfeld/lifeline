import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { initApps, setTypeIconResolver, startSync } from "@lifeline/core";
import { typeIcon } from "@lifeline/ui";
import { choresApp } from "@lifeline/app-chores";
import { tasksApp } from "@lifeline/app-tasks";
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
import { clipperApp } from "@lifeline/app-clipper";
import { writerApp } from "@lifeline/app-writer";
import { workoutApp } from "@lifeline/app-workout";
import { bibleApp } from "@lifeline/app-bible";
import { ledgerApp } from "@lifeline/app-ledger";
import { pocketApp } from "@lifeline/app-pocket";
import { hubApp } from "./hub";
import App from "./App";
import "./index.css";

// Compile-time App registry (ADR 0003): every App joins here.
setTypeIconResolver(typeIcon);
initApps([hubApp, choresApp, tasksApp, calendarApp, statsApp, lifelevelApp, libraryApp, cinemaApp, discothequeApp, arcadeApp, commonplaceApp, museumApp, notesApp, clipperApp, writerApp, sourcesApp, workoutApp, bibleApp, ledgerApp, pocketApp]);
startSync();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
