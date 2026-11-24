import { useEffect } from "react";
import { useLocation } from "react-router";
import { ContentContainer, preloadLazyChunks, Toaster, useDocumentTitle, usePhone } from "@lifeline/ui";
import { backgroundApps, ensureBuiltinMacros, ensureDefaultWorkspace, isDemo, useSyncState, type AppManifest } from "@lifeline/core";
import { CommandPalette } from "./components/CommandPalette";
import { AccountDialogs } from "./components/AccountDialogs";
import { PrivateDialogs } from "./vault/PrivateDialogs";
import { PushProvider } from "./surfaces/push";
import { MobileNav } from "./mobile/MobileNav";
import { PhoneHeader } from "./mobile/PhoneHeader";
import { MacroHost } from "./macros/MacroHost";
import { KeyBindingHost } from "./keys/KeyBindingHost";
import { useResume } from "./nav/resume";
import { placeTitle } from "./nav/placeTitle";
import { PeekHost } from "./peek/PeekHost";
import { SelectionMenu } from "./intake/SelectionMenu";
import { DemoBanner, DemoFilling } from "./demo/DemoBanner";
import { RouteBoundary } from "./components/ErrorBoundary";
import { Places } from "./Places";
import { Hub } from "./hub/Hub";

/**
 * Once the first page has painted and the browser is idle, fetch every lazy
 * chunk (ADR 0099), so a loaded app keeps working offline. `data-chunks` on
 * <html> says when they are all in (the Demo's offline e2e case waits on it).
 */
function usePreloadChunks() {
  useEffect(() => {
    const start = () => void preloadLazyChunks().then(() => (document.documentElement.dataset.chunks = "loaded"));
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(start, 2000);
    return () => clearTimeout(t);
  }, []);
}

/** One component per App with a background hook, so each hook runs under React's rules (ADR 0032). */
function AppBackground({ app }: { app: AppManifest }) {
  app.useBackground!();
  return null;
}

export default function App() {
  useResume();
  // The tab names the place; a page's PageHeader names it more closely (WCAG 2.4.2).
  useDocumentTitle(placeTitle(useLocation().pathname), { fallback: true });
  usePreloadChunks();
  const phone = usePhone();
  // A genuinely empty account makes its one Workspace here; an existing one was
  // given it by the server (PocketBase migration 1757400000), and this waits
  // for the first full pull rather than racing it into a second "Personal"
  // (ADR 0047). Keyed on the sync state so it runs again the moment that pull
  // lands — nothing else re-renders when a cycle finishes.
  const { state: syncState } = useSyncState();
  useEffect(() => {
    void ensureDefaultWorkspace();
    // The built-in Macros, given once per account, on the same wait (ADR 0094).
    void ensureBuiltinMacros();
  }, [syncState]);
  return (
    <PushProvider>
      {/* The page root is a content container: on a phone it is the place's; on the
          desk each Window is its own, inside it. */}
      <ContentContainer className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
        {backgroundApps().map((a) => (
          <AppBackground key={a.id} app={a} />
        ))}
        {/* Above everything, the Phone header included: ADR 0064 keeps banners at the top. */}
        {isDemo() && <DemoBanner />}
        {isDemo() && <DemoFilling />}
        {phone ? (
          <>
            <PhoneHeader />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Each place has its own boundary (#301), inside its Module's chrome; this one catches the chrome. */}
              <RouteBoundary>
                <Places />
              </RouteBoundary>
            </div>
            <MobileNav />
          </>
        ) : (
          // The desk is the Hub (ADR 0133): its index, and a stage of Windows, each its own container.
          <Hub />
        )}
        <CommandPalette />
        <KeyBindingHost />
        <PeekHost />
        <MacroHost />
        <SelectionMenu />
        <PrivateDialogs />
        {/* The Demo never signs in (ADR 0077): no sign-in, no signed-out notice, no account switch. */}
        {!isDemo() && <AccountDialogs />}
        <Toaster position="bottom-right" />
      </ContentContainer>
    </PushProvider>
  );
}
