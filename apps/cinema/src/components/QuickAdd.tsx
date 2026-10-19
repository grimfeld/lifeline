import { QuickAdd as FamilyQuickAdd, type QuickAddConfig, type QuickAddProps } from "@lifeline/parts";
import { WORK_TYPES, workType, type WorkTypeId } from "../domain/workTypes";
import { deleteWork, parseQuickTitle, quickAddWork, useLookupSettings } from "../data/repo";
import { lookupFor, resolveHit, type WorkHit } from "../data/lookup";
import { Cover } from "./Cover";

/** What QuickAdd shows for an add: the Work you already have is handed back, with where it stands. */
function shown({ id, twin }: Awaited<ReturnType<typeof quickAddWork>>, title: string) {
  return twin ? { id: twin.id, title: twin.title, already: workType(twin.type).engagement[twin.engagement] } : { id, title };
}

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
      return shown(await quickAddWork({ medium, title, creator: creator || undefined }), title);
    }
    const title = input.hit.title.trim();
    if (!title) return null;
    // Lazy enrichment (TMDB director/runtime) happens only on pick.
    const hit = await resolveHit(input.hit);
    return shown(await quickAddWork({ medium, title, creator: input.hit.creator || hit.creator, hit }), title);
  },
  remove: deleteWork,
};

export function QuickAdd(props: QuickAddProps<WorkTypeId>) {
  return <FamilyQuickAdd config={CINEMA} {...props} />;
}
