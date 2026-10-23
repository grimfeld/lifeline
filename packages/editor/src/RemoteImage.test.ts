import { describe, expect, it } from "vitest";
import { remoteHost } from "./RemoteImage";

describe("remoteHost (#270)", () => {
  const here = "https://lifeline.example";
  it("names the other site an image would be fetched from", () => {
    expect(remoteHost("https://tracker.example/p.gif", here)).toBe("tracker.example");
    expect(remoteHost("http://cdn.example:8080/a.png", here)).toBe("cdn.example:8080");
  });
  it("is null when loading reaches no other site", () => {
    expect(remoteHost("https://lifeline.example/icon.png", here)).toBeNull();
    expect(remoteHost("/icon.png", here)).toBeNull();
    expect(remoteHost("data:image/png;base64,AAAA", here)).toBeNull();
  });
});
