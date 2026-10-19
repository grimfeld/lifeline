/**
 * The options page: the Lifeline URL, defaulting to the deployed Lifeline. A
 * self-hosted one is asked for as a host permission when it is saved — that
 * origin only — so the extension can close its window at the done address.
 */
import { DEFAULT_LIFELINE_URL, LIFELINE_URL_KEY, lifelineHostPattern, lifelineUrl } from "./lifeline";

const form = document.getElementById("form") as HTMLFormElement;
const input = document.getElementById("url") as HTMLInputElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const reset = document.getElementById("reset") as HTMLButtonElement;

input.placeholder = DEFAULT_LIFELINE_URL;
void chrome.storage.sync.get(LIFELINE_URL_KEY).then((got) => {
  const stored = got[LIFELINE_URL_KEY];
  input.value = typeof stored === "string" && lifelineUrl(stored) ? stored : DEFAULT_LIFELINE_URL;
});

function say(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle("error", error);
  input.setAttribute("aria-invalid", String(error));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const base = lifelineUrl(input.value);
  if (!base) return say("That is not a web address — it starts with https://", true);
  // Asked for in the click itself: Firefox grants a permission only from the person's own gesture.
  const granted = base === DEFAULT_LIFELINE_URL ? Promise.resolve(true) : chrome.permissions.request({ origins: [lifelineHostPattern(base)] });
  void granted.then(async (ok) => {
    await chrome.storage.sync.set({ [LIFELINE_URL_KEY]: base });
    input.value = base;
    say(ok ? "Saved." : "Saved. Without access to that address the Handoff window will not close by itself after saving.");
  });
});

reset.addEventListener("click", () => {
  void chrome.storage.sync.remove(LIFELINE_URL_KEY).then(() => {
    input.value = DEFAULT_LIFELINE_URL;
    say("Saved.");
  });
});
