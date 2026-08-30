import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@lifeline/ui";

/**
 * The jar (CONTEXT: Allowance) — Pocket's meter. Full at the period's start,
 * it drains as Spends land; overspent it stands empty with a crack. The
 * liquid is the face's colour. Motion only: the level pours in on mount,
 * slides on every change, and the jar shakes once the moment it goes over —
 * all of it off under `prefers-reduced-motion`, none of it sound.
 */
export function Jar({ level, over, color, size = "lg", className }: { level: number; over: boolean; color: string; size?: "lg" | "sm"; className?: string }) {
  const [poured, setPoured] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPoured(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const wasOver = useRef(over);
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    const crossed = over && !wasOver.current;
    wasOver.current = over;
    if (!crossed) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 600);
    return () => clearTimeout(t);
  }, [over]);

  const shown = poured ? Math.max(0, Math.min(1, level)) : 0;
  const dims = size === "lg" ? "h-[88px] w-[66px]" : "h-5 w-[15px]";
  const clip = useId();
  const glide = "motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out";

  return (
    <svg viewBox="0 0 48 64" aria-hidden className={cn(dims, "shrink-0 overflow-visible", shaking && "motion-safe:animate-jar-shake", className)}>
      <defs>
        <clipPath id={clip}>
          <rect x="7" y="13" width="34" height="48" rx="7" />
        </clipPath>
      </defs>
      {/* lid */}
      <rect x="14" y="2" width="20" height="8" rx="2.5" className={over ? "fill-destructive/70" : "fill-muted-foreground/60"} />
      {/* glass */}
      <rect x="6" y="12" width="36" height="50" rx="8" className="fill-muted/40 stroke-muted-foreground/50" strokeWidth={size === "lg" ? 1.5 : 2.5} />
      {/* liquid: a full-height rect scaled up from the bottom, so every level change glides */}
      <g clipPath={`url(#${clip})`}>
        <rect x="7" y="13" width="34" height="48" style={{ fill: color, transform: `scaleY(${shown})`, transformOrigin: "24px 61px" }} className={glide} />
        <rect x="7" y="13" width="34" height="3" style={{ fill: "white", opacity: shown > 0.02 ? 0.35 : 0, transform: `translateY(${(1 - shown) * 48}px)` }} className={glide} />
      </g>
      {/* crack */}
      {over && <path d="M20 26 l5 7 l-4 6 l6 9" fill="none" className="stroke-destructive" strokeWidth={size === "lg" ? 2 : 3.5} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
