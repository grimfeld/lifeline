import type { AppManifest } from "@lifeline/core";
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

/**
 * Every App, in the shell's registry order (ADR 0003): the server registers
 * the same types, indexes and hooks a device does. Keep in step with
 * shell/src/main.tsx.
 */
export const manifests: AppManifest[] = [
  choresApp,
  pantryApp,
  shoppingApp,
  tasksApp,
  projectsApp,
  calendarApp,
  statsApp,
  lifelevelApp,
  libraryApp,
  cinemaApp,
  discothequeApp,
  arcadeApp,
  commonplaceApp,
  museumApp,
  notesApp,
  thoughtsApp,
  writerApp,
  manuscriptApp,
  sourcesApp,
  workoutApp,
  ledgerApp,
  pocketApp,
  pricesApp,
  moodApp,
  mailApp,
  swearjarApp,
  knowledgeApp,
];
