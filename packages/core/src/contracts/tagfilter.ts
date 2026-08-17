import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { composeTagFilter, EMPTY_TAG_FILTER, type TagFilter } from "../tags";

/**
 * The Tag filter in effect where a component renders (ADR 0014). Core wraps
 * every Card instance on a Screen with the Screen's tags ∧ the instance's
 * own `tags` setting; Surface pages may wrap themselves with a session
 * filter. Contract read-side hooks consult it automatically; App-owned
 * listing Cards read it with useTagFilter() and call matchesTagFilter().
 */
const TagFilterContext = createContext<TagFilter>(EMPTY_TAG_FILTER);

export function useTagFilter(): TagFilter {
  return useContext(TagFilterContext);
}

/** Narrows the ambient filter by another any-of set (composes, never replaces). */
export function TagFilterProvider({ tags, children }: { tags?: readonly string[] | null; children?: ReactNode }) {
  const parent = useContext(TagFilterContext);
  const value = useMemo(() => composeTagFilter(...parent, tags), [parent, tags]);
  return createElement(TagFilterContext.Provider, { value }, children);
}
