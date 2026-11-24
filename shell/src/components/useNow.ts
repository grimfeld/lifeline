import { useEffect, useState } from "react";

/** The time now, ticking every 15s: the Hub's clock on the desk and the phone's header. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
