import { describe, expect, it } from "vitest";
import { manifest } from "./manifest";

describe("manifest", () => {
  const chrome = manifest("chrome");
  const firefox = manifest("firefox");

  it("asks for no more than contextMenus, activeTab, scripting, storage and the Lifeline URL", () => {
    for (const m of [chrome, firefox]) {
      expect(m.manifest_version).toBe(3);
      expect([...m.permissions].sort()).toEqual(["activeTab", "contextMenus", "scripting", "storage"]);
      expect(m.host_permissions).toEqual(["https://lifeline.grimfeld.tech/*"]);
      expect(m).not.toHaveProperty("content_scripts");
      // No options: the Lifeline it sends to is built in, so no other origin is ever asked for.
      expect(m).not.toHaveProperty("optional_host_permissions");
      expect(m).not.toHaveProperty("options_ui");
    }
  });

  it("sends on Alt+Shift+L through the toolbar button's command", () => {
    for (const m of [chrome, firefox]) {
      expect(m.commands._execute_action.suggested_key.default).toBe("Alt+Shift+L");
      expect(m.action).toBeDefined();
    }
  });

  it("differs between the browsers only in the background and Firefox's add-on id", () => {
    expect(chrome.background).toEqual({ service_worker: "background.js" });
    expect(firefox.background).toEqual({ scripts: ["background.js"] });
    expect(firefox.browser_specific_settings?.gecko.id).toMatch(/@/);
    expect(chrome).not.toHaveProperty("browser_specific_settings");
    const { background: _c, ...restChrome } = chrome;
    const { background: _f, browser_specific_settings: _g, ...restFirefox } = firefox;
    expect(restFirefox).toEqual(restChrome);
  });
});
