import { QuickAdd as FamilyQuickAdd, type QuickAddConfig, type QuickAddProps } from "@lifeline/parts";
import { WORK_TYPES, type WorkTypeId } from "../domain/workTypes";
import { deleteWork, parseQuickTitle, quickAddWork, useLookupSettings } from "../data/repo";
import { lookupFor, resolveHit } from "../data/lookup";
import { hitByline, type WorkHit } from "../data/openlibrary";
import { Cover } from "./Cover";

/** The Library's QuickAdd: books, comics and manga, looked up by free text. */
const LIBRARY: QuickAddConfig<WorkTypeId, WorkHit> = {
  media: WORK_TYPES,
  creatorHint: "author",
  useSearch(medium) {
    const lookup = lookupFor(medium, useLookupSettings());
    return lookup && ((q, signal) => lookup({ text: q }, signal));
  },
  byline: hitByline,
  cover: (h, medium) => <Cover item={{ title: h.title, coverUrl: h.coverUrl, type: medium }} className="h-8 w-6 shrink-0" />,
  async add(medium, input) {
    if ("text" in input) {
      const { title, author } = parseQuickTitle(input.text);
      if (!title) return null;
      return { id: await quickAddWork({ medium, title, author }), title };
    }
    const title = input.hit.title.trim();
    if (!title) return null;
    // Lazy enrichment happens only on pick; a hit's Authors are found or created (ADR 0052).
    const hit = await resolveHit(input.hit);
    return { id: await quickAddWork({ medium, title, hit }), title };
  },
  remove: deleteWork,
};

export function QuickAdd(props: QuickAddProps<WorkTypeId>) {
  return <FamilyQuickAdd config={LIBRARY} {...props} />;
}
