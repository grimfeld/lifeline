import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { initApps, isDemo, setTypeIconResolver, setTypeIntakeDialog, startSync } from "@lifeline/core";
import { TooltipProvider, typeIcon } from "@lifeline/ui";
import { APPS } from "./apps";
import App from "./App";
import { TypeIntakeDialog } from "./intake/TypeIntakeDialog";
import { startDemo } from "./demo/start";
import "./index.css";

// The App registry lives in ./apps (ADR 0003). The Demo (ADR 0077) shows every App:
// none of them needs a server since Mail was retired (ADR 0080).
setTypeIconResolver(typeIcon);
// Core's generic Intake for user-defined types (ADR 0086) is drawn by the shell, as the type icons are.
setTypeIntakeDialog(TypeIntakeDialog);
initApps(APPS);
startSync();

const root = ReactDOM.createRoot(document.getElementById("root")!);
const app = (
  <React.StrictMode>
    <BrowserRouter>
      {/* The one TooltipProvider (desk only — Tooltip renders nothing on touch). */}
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if (isDemo()) {
  // The Demo opens lived-in (ADR 0077): today is written before the first screen, the rest just after.
  startDemo(root, app);
  // The e2e suite's own Demo build only (playwright.config.ts): the deployed Demo has no test hook.
  if (import.meta.env.VITE_DEMO_E2E === "1") void import("./demo/inspect").then((m) => m.exposeForTests());
} else {
  root.render(app);
}
