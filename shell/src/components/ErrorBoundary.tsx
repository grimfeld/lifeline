import { Component, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button, EmptyState } from "@lifeline/ui";
import { House, RotateCcw } from "lucide-react";
import { FALLBACK_PLACE } from "../nav/resume";

/**
 * Catches a throw below it and shows `fallback` instead, so one broken piece
 * does not take the whole shell down. It logs nothing itself: the root's
 * `onCaughtError` (main.tsx) logs every error a boundary catches.
 * A change of `resetKey` (the place, a Card's settings) tries the children again.
 */
export class ErrorBoundary extends Component<
  { fallback: (reset: () => void) => ReactNode; resetKey?: string; children: ReactNode },
  { error: unknown; resetKey?: string }
> {
  state: { error: unknown; resetKey?: string } = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error("Unknown error") };
  }

  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: unknown; resetKey?: string }) {
    // A new place or new settings: forget the old error and render the children again.
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
  }

  reset = () => this.setState({ error: null });

  render() {
    return this.state.error ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** A page that broke: what happened, and the way out. Clears itself when the place changes. */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ErrorBoundary
      resetKey={location.pathname + location.search}
      fallback={() => (
        <div className="p-4 md:p-6">
          <EmptyState
            role="alert"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => window.location.reload()}>
                  <RotateCcw /> Reload
                </Button>
                {/* Not `/`: that resumes the last place, which is this one. */}
                <Button variant="outline" onClick={() => navigate(FALLBACK_PLACE)}>
                  <House /> Go home
                </Button>
              </div>
            }
          >
            Something went wrong on this page. Your data is safe; reload to try again.
          </EmptyState>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/** A Card that broke shows this in its body; the rest of the page keeps working. */
export function CardBoundary({ resetKey, children }: { resetKey?: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      resetKey={resetKey}
      fallback={(reset) => (
        <div role="alert" className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
          This card couldn't load.
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw /> Try again
          </Button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
