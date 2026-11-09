import type { RecallFaceProps } from "@lifeline/core";
import { parseCloze, plainSentence } from "../domain/cloze";
import { LISTEN } from "../domain/prompts";
import type { Fact, Sentence, Word } from "../domain/types";
import { OriginLine } from "./OriginLine";
import { ClipPlayer } from "./ClipPlayer";

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
  const listen = slot === LISTEN;
  const forward = slot === "forward";
  const question = forward ? w.term || w.title : w.meaning;
  const answer = listen ? w.term || w.title : forward ? w.meaning : w.term || w.title;
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs">{listen ? "What did you hear?" : forward ? "What does it mean?" : "How do you say it?"}</span>
      {/* A listening Prompt's one player plays as the Prompt appears and is never restarted by the reveal; otherwise it comes with the answer. */}
      {listen ? <ClipPlayer clipId={w.clip} /> : <span className="max-w-full text-3xl font-semibold break-words">{question}</span>}
      <div className="min-h-16 max-w-full">
        {revealed && (
          <div className="grid gap-2">
            {listen ? (
              <>
                <span className="max-w-full text-3xl font-semibold break-words">{answer}</span>
                <span className="text-primary text-2xl break-words">{w.meaning}</span>
              </>
            ) : (
              <>
                <span className="text-primary text-2xl break-words">{answer}</span>
                <ClipPlayer clipId={w.clip} />
              </>
            )}
            {w.notes && <span className="text-muted-foreground text-sm whitespace-pre-wrap">{w.notes}</span>}
            <OriginLine originId={w.originId} />
          </div>
        )}
      </div>
    </div>
  );
}

/** A Sentence's Prompt: its other blanks filled and this one open, with the translation beside it. A listening Prompt is the clip, with the whole sentence as its answer. */
export function SentenceFace({ doc, slot, revealed }: RecallFaceProps) {
  const sentence = doc as Sentence;
  const listen = slot === LISTEN;
  const parts = parseCloze(sentence.text ?? "");
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs">{listen ? "What did you hear?" : "Fill the blank"}</span>
      {listen ? (
        <ClipPlayer clipId={sentence.clip} />
      ) : (
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
                  {p.hint ? <span className="text-muted-foreground px-1 text-base italic">{p.hint}</span> : <>&nbsp;</>}
                </span>
              )
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </p>
      )}
      {listen && revealed && <p className="text-primary max-w-full text-2xl leading-relaxed break-words">{plainSentence(sentence.text ?? "")}</p>}
      {(listen ? revealed : true) && sentence.translation && <span className="text-muted-foreground max-w-full text-sm break-words italic">{sentence.translation}</span>}
      {revealed && sentence.notes && <span className="text-muted-foreground max-w-full text-sm break-words whitespace-pre-wrap">{sentence.notes}</span>}
      {revealed && !listen && <ClipPlayer clipId={sentence.clip} />}
      {revealed && <OriginLine originId={sentence.originId} className="max-w-full" />}
    </div>
  );
}

/** A Fact's one Prompt: its question, then its answer — with the notes, and where it was kept from. */
export function FactFace({ doc, revealed }: RecallFaceProps) {
  const f = doc as Fact;
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs">Recall</span>
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
