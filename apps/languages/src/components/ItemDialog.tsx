import { FACT, SENTENCE, WORD, type Item } from "../domain/types";
import { FactDialog } from "./FactDialog";
import { SentenceDialog } from "./SentenceDialog";
import { WordDialog } from "./WordDialog";

/** The edit dialog for whichever kind of item this is (Word, Sentence or Fact); closed while there is no item. */
export function ItemDialog({ item, open, onOpenChange }: { item: Item | undefined; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <>
      <WordDialog open={open && item?.type === WORD} onOpenChange={onOpenChange} word={item?.type === WORD ? item : undefined} />
      <SentenceDialog open={open && item?.type === SENTENCE} onOpenChange={onOpenChange} sentence={item?.type === SENTENCE ? item : undefined} />
      <FactDialog open={open && item?.type === FACT} onOpenChange={onOpenChange} fact={item?.type === FACT ? item : undefined} />
    </>
  );
}
