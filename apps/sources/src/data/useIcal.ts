import { useEffect, useState } from "react";
import { loadIcal, type Ical } from "../domain/ical";

/** ical.js once loaded, or null while it loads; it starts loading only when `wanted`. */
export function useIcal(wanted: boolean): Ical | null {
  const [ical, setIcal] = useState<Ical | null>(null);
  useEffect(() => {
    if (!wanted || ical) return;
    let live = true;
    void loadIcal().then((m) => {
      if (live) setIcal(() => m);
    });
    return () => {
      live = false;
    };
  }, [wanted, ical]);
  return ical;
}
