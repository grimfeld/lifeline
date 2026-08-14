import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { initApps, startSync } from "@lifeline/core";
import { choresApp } from "@lifeline/app-chores";
import { hubApp } from "./hub";
import App from "./App";
import "./index.css";

// Compile-time App registry (ADR 0003): every App joins here.
initApps([hubApp, choresApp]);
startSync();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
