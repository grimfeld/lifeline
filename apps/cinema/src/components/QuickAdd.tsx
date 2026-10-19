import { QuickAdd as FamilyQuickAdd, type QuickAddConfig, type QuickAddProps } from "@lifeline/parts";
import { WORK_TYPES, type WorkTypeId } from "../domain/workTypes";
import { deleteWork, parseQuickTitle, quickAddWork, useLookupSettings } from "../data/repo";
import { lookupFor, resolveHit, type WorkHit } from "../data/lookup";
import { Cover } from "./Cover";

/** The Cinema's QuickAdd: movies and series, looked up on TMDB when a key is set. */
const CINEMA: QuickAddConfig<WorkTypeId, WorkHit> = {
  media: WORK_TYPES,
  useSearch: (medium) => lookupFor(medium, useLookupSettings()),
  byline: (h) => h.creator,
  cover: (h, medium) => <Cover item={{ title: h.title, coverUrl: h.coverUrl, type: medium }} className="h-8 w-6 shrink-0" />,
  async add(medium, input) {
    if ("text" in input) {
      const { title, creator } = parseQuickTitle(input.text);
      if (!title) return null;
      return { id: await quickAddWork({ medium, title, creator: creator || undefined }), title };
    }
    const title = input.hit.title.trim();
    if (!title) return null;
    // Lazy enrichment (TMDB director/runtime) happens only on pick.
    const hit = await resolveHit(input.hit);
    return { id: await quickAddWork({ medium, title, creator: input.hit.creator || hit.creator, hit }), title };
  },
  remove: deleteWork,
};

export function QuickAdd(props: QuickAddProps<WorkTypeId>) {
  return <FamilyQuickAdd config={CINEMA} {...props} />;
}
