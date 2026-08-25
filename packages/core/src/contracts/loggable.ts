import { appById, loggableProviders } from "../registry";

/** What a target wants with each log: nothing (a Habit tick, a Boolean Stat), or one number in its unit. */
export type LoggableWant = "none" | "number";

/**
 * A place another App may log an occurrence into (ADR 0031): a Stat, a Habit.
 * The owning App lists them and does the writing; the sender only names the
 * target and the moment.
 */
export interface LoggableTarget {
  /** `${appId}/${id}` — unique across Apps. */
  key: string;
  appId: string;
  id: string;
  title: string;
  subtitle?: string;
  wants: LoggableWant;
  /** For `number`: the unit the value is read in ("min", "kg", "reps"…). */
  unit?: string;
}

export interface LogPayload {
  /** ISO instant the occurrence happened. */
  at: string;
  /** For targets that want a number. Ignored otherwise. */
  value?: number;
  note?: string;
}

export interface LoggableProvider {
  appId: string;
  /** React hook. Live list of this App's targets. */
  useTargets(): LoggableTarget[];
  /** Delegate of "another App logged this here": the App writes its own Document. */
  log(targetId: string, payload: LogPayload): Promise<void>;
}

/** Read side of the Loggable Contract (ADR 0031): every App's targets, in registry order. */
export function useLoggableTargets(): LoggableTarget[] {
  const providers = loggableProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  return providers.flatMap((p) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    p.useTargets().map((t) => ({ ...t, key: t.key || `${p.appId}/${t.id}`, appId: p.appId })),
  );
}

/** Split a target key back into its App and id. */
export function parseTargetKey(key: string): { appId: string; id: string } {
  const i = key.indexOf("/");
  return i === -1 ? { appId: key, id: "" } : { appId: key.slice(0, i), id: key.slice(i + 1) };
}

/** Log an occurrence into a target through its owning App. Throws when no App owns it. */
export async function logTo(targetKey: string, payload: LogPayload): Promise<void> {
  const { appId, id } = parseTargetKey(targetKey);
  const provider = loggableProviders().find((p) => p.appId === appId);
  if (!provider) throw new Error(`${appById(appId)?.title ?? appId} accepts no logs`);
  await provider.log(id, payload);
}
