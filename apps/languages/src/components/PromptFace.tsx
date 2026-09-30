import { parseCloze } from "../domain/cloze";
import { SENTENCE, type Item, type Sentence, type Word } from "../domain/types";

/**
 * One Prompt as shown in a Practice: the question, and — once revealed — the
 * answer. A Word's forward asks for the meaning, its reverse for the term; a
 * Sentence shows its other blanks filled and this one open, with the
 * translation beside it.
 */
export function PromptFace({ item, slot, revealed }: { item: Item; slot: string; revealed: boolean }) {
  if (item.type === SENTENCE) return <SentenceFace sentence={item as Sentence} slot={slot} revealed={revealed} />;
  const w = item as Word;
  const forward = slot === "forward";
  const question = forward ? w.term : w.meaning;
  const answer = forward ? w.meaning : w.term;
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">{forward ? "What does it mean?" : "How do you say it?"}</span>
      <span className="text-3xl font-semibold break-words">{question}</span>
      <div className="min-h-16">
        {revealed && (
          <div className="grid gap-2">
            <span className="text-primary text-2xl break-words">{answer}</span>
            {w.notes && <span className="text-muted-foreground text-sm whitespace-pre-wrap">{w.notes}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function SentenceFace({ sentence, slot, revealed }: { sentence: Sentence; slot: string; revealed: boolean }) {
  const parts = parseCloze(sentence.text);
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">Fill the blank</span>
      <p className="text-2xl leading-relaxed break-words">
        {parts.map((p, i) =>
          p.kind === "text" ? (
            <span key={i}>{p.text}</span>
          ) : p.slot === slot ? (
            revealed ? (
              <span key={i} className="text-primary border-primary border-b-2 font-semibold">
                {p.text}
              </span>
            ) : (
              <span key={i} className="border-muted-foreground inline-block min-w-16 border-b-2 align-baseline">
                &nbsp;
              </span>
            )
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
      {sentence.translation && <span className="text-muted-foreground text-sm italic">{sentence.translation}</span>}
    </div>
  );
}
