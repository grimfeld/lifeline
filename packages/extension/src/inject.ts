/**
 * Injected into the page the person sends — only then, through activeTab — to
 * make the reader callable there. The background then calls it in the same
 * (extension's own, isolated) world and gets the Handoff back.
 */
import { readPage } from "./reader";

(globalThis as { __lifelineReadPage?: () => unknown }).__lifelineReadPage = () => readPage(document, document.getSelection());
