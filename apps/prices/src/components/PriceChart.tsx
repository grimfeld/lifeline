import { lazy, Suspense, type ComponentProps } from "react";
import { COLOR_SLOTS, colorVar } from "@lifeline/ui";
import type { Shop } from "../domain/types";

// recharts stays out of the first load (the Product price Card would carry it):
// the chart loads on first draw, behind a placeholder of its height.
const Impl = lazy(() => import("./PriceChartImpl").then((m) => ({ default: m.PriceChart })));

/** One stable colour per Shop, by its position in the sorted Shop list. */
export function shopColor(shopId: string, shops: readonly Shop[]): string {
  const i = Math.max(0, shops.findIndex((s) => s.id === shopId));
  return colorVar(COLOR_SLOTS[i % COLOR_SLOTS.length]!);
}

/**
 * A Product's unit price over time, one series per Shop; promo points are
 * hollow so a one-off deal never reads as the usual price (ADR 0082).
 */
export function PriceChart(props: ComponentProps<typeof Impl>) {
  return (
    <Suspense fallback={<div style={{ height: props.height ?? 240 }} />}>
      <Impl {...props} />
    </Suspense>
  );
}
