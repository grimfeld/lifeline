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
import { mediaApp } from "@lifeline/app-media";
import { museumApp } from "@lifeline/app-museum";
import { notesApp } from "@lifeline/app-notes";
import { clipperApp } from "@lifeline/app-clipper";
import { writerApp } from "@lifeline/app-writer";
import { hubApp } from "./hub";
import App from "./App";
import "./index.css";

// Compile-time App registry (ADR 0003): every App joins here.
setTypeIconResolver(typeIcon);
initApps([hubApp, choresApp, tasksApp, calendarApp, statsApp, mediaApp, museumApp, notesApp, clipperApp, writerApp, sourcesApp]);
startSync();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
