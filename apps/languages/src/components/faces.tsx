import type { RecallFaceProps } from "@lifeline/core";
import { parseCloze } from "../domain/cloze";
import type { Fact, Sentence, Word } from "../domain/types";
import { OriginLine } from "./OriginLine";

/*
 * Every line is held to the card's width (`max-w-full`): centred grid items
 * otherwise size to their longest word and spill out (ADR 0065).
 */

/**
 * A Word's Prompt as shown in a Practice: its forward asks for the meaning,
 * its reverse for the term; the notes come with the answer.
 */
export function WordFace({ doc, slot, revealed }: RecallFaceProps) {
  const w = doc as Word;
  const forward = slot === "forward";
  const question = forward ? w.term || w.title : w.meaning;
  const answer = forward ? w.meaning : w.term || w.title;
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">{forward ? "What does it mean?" : "How do you say it?"}</span>
      <span className="max-w-full text-3xl font-semibold break-words">{question}</span>
      <div className="min-h-16 max-w-full">
        {revealed && (
          <div className="grid gap-2">
            <span className="text-primary text-2xl break-words">{answer}</span>
            {w.notes && <span className="text-muted-foreground text-sm whitespace-pre-wrap">{w.notes}</span>}
            <OriginLine originId={w.originId} />
          </div>
        )}
      </div>
    </div>
  );
}

/** A Sentence's Prompt: its other blanks filled and this one open, with the translation beside it. */
export function SentenceFace({ doc, slot, revealed }: RecallFaceProps) {
  const sentence = doc as Sentence;
  const parts = parseCloze(sentence.text ?? "");
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">Fill the blank</span>
      <p className="max-w-full text-2xl leading-relaxed break-words">
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
      {sentence.translation && <span className="text-muted-foreground max-w-full text-sm break-words italic">{sentence.translation}</span>}
      {revealed && <OriginLine originId={sentence.originId} className="max-w-full" />}
    </div>
  );
}

/** A Fact's one Prompt: its question, then its answer — with the notes, and where it was kept from. */
export function FactFace({ doc, revealed }: RecallFaceProps) {
  const f = doc as Fact;
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">Recall</span>
      <span className="max-w-full text-2xl font-semibold break-words">{f.question || f.title}</span>
      <div className="min-h-16 max-w-full">
        {revealed && (
          <div className="grid gap-2">
            <span className="text-primary text-xl whitespace-pre-wrap break-words">{f.answer}</span>
            {f.notes && <span className="text-muted-foreground text-sm whitespace-pre-wrap break-words">{f.notes}</span>}
            <OriginLine originId={f.originId} />
          </div>
        )}
      </div>
    </div>
  );
}
