import { useDocument } from "@lifeline/core";
import { plainSentence } from "../domain/cloze";
import { FACT, SENTENCE, WORD, type Fact, type PuzzleDraw, type Sentence, type Word } from "../domain/types";
import { OriginLine } from "./OriginLine";

/**
 * One piece of material a Puzzle drew, in full (ADR 0106): the item as kept
 * now — term and meaning, question and answer, the Sentence and its
 * translation — with its notes and where it was met; or, once deleted,
 * the answer and clue as drawn.
 */
export function PuzzleMaterial({ draw }: { draw: PuzzleDraw }) {
  const live = useDocument<Word | Fact | Sentence>(draw.itemId || undefined);
  const item = live && (live.type === WORD || live.type === FACT || live.type === SENTENCE) ? live : undefined;
  const [head, body, notes] =
    item?.type === WORD
      ? [item.term, item.meaning, item.notes]
      : item?.type === FACT
        ? [item.answer, item.question, item.notes]
        : item?.type === SENTENCE
          ? [draw.answer, plainSentence(item.text ?? ""), item.translation]
          : [draw.answer, draw.clue, draw.hint];
  return (
    <li className="grid min-w-0 gap-0.5 rounded-lg border px-3 py-2">
      <span className="font-semibold">{head}</span>
      <span className="text-sm">{body}</span>
      {notes && <span className="text-muted-foreground text-sm whitespace-pre-wrap">{notes}</span>}
      {item ? <OriginLine originId={item.originId} origin={item.origin} /> : <span className="text-muted-foreground text-xs">This has since been deleted.</span>}
    </li>
  );
}
