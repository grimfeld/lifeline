import { QuickAdd as FamilyQuickAdd, type QuickAddConfig, type QuickAddProps } from "@lifeline/parts";
import { WORK_TYPES, workType, type WorkTypeId } from "../domain/workTypes";
import { deleteWork, parseQuickTitle, quickAddWork, useLookupSettings } from "../data/repo";
import { lookupFor, resolveHit } from "../data/lookup";
import { hitByline, type WorkHit } from "../data/openlibrary";
import { Cover } from "./Cover";
import { ACQ_LABEL } from "./AddWorkDialog";

/** What QuickAdd shows for an add: the Work you already have is handed back, with where it stands. */
function shown({ id, twin }: Awaited<ReturnType<typeof quickAddWork>>, title: string) {
  return twin ? { id: twin.id, title: twin.title, already: `${ACQ_LABEL[twin.acquisition]}, ${workType(twin.type).engagement[twin.engagement]}` } : { id, title };
}

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
      return shown(await quickAddWork({ medium, title, author }), title);
    }
    const title = input.hit.title.trim();
    if (!title) return null;
    // Lazy enrichment happens only on pick; a hit's Authors are found or created (ADR 0052).
    const hit = await resolveHit(input.hit);
    return shown(await quickAddWork({ medium, title, hit }), title);
  },
  remove: deleteWork,
};

export function QuickAdd(props: QuickAddProps<WorkTypeId>) {
  return <FamilyQuickAdd config={LIBRARY} {...props} />;
}
