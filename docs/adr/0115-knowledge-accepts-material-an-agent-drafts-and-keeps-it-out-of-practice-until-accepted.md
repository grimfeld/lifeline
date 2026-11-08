---
status: accepted
amends: ADR 0073 (in part — an agent may draft material, and Knowledge reports practice to it)
---

# Knowledge accepts material an agent drafts, and keeps it out of practice until accepted

ADR 0073 kept acquisition out of Lifeline. CONTEXT.md went further: nothing is phrased for the user, and an agent may add only what the user dictates word for word. In practice an agent outside Lifeline (ADR 0091) is teaching the user, a language mostly. It writes lessons and wants to keep their material, and it chooses the next lesson from what the user gets wrong. The rule made that agent either break it or hand everything back to be retyped. And it could not see a single Recall, because Recalls are internal Documents and the MCP server hides those.

So:

- **An agent may draft.** A Word, Sentence or Fact may be a **draft**: listed, editable, but out of every Practice, Puzzle, Retention and report until the user **accepts** it. Drafting is not adding: a draft says what was drafted and by whom in its origin, and that mark stays after acceptance, so the user's own material and the agent's stay apart.
- **Acceptance is the user's.** One at a time (accept, edit then accept, or delete), or a whole Deck at once after every item has been shown. A draft enters practice as new when it is accepted, and the daily new cap counts it from then.
- **An agent may make and fill Decks.** A lesson is a Deck. An agent never changes accepted material: it proposes a rewrite, which arrives as a draft change the user accepts or discards. It never pauses, unpauses or deletes.
- **Knowledge reports practice, read-only.** A `knowledge_report` MCP tool returns, per Topic or Deck: Retention, the Leeches and the Prompts failed most in the last 30 days with their latest Recalls (typed attempts included, ADR 0116), and what is due. Lifeline still decides nothing about what comes next. The agent outside does.
- **Unchanged.** Lifeline itself drafts nothing: no generated drills, no dictionary, no grammar fields that would let it derive material. Nothing enters practice unchosen. Grammar a user wants drilled is written as Sentences.

## Considered options

- **Keep the rule; the user retypes what the agent taught.** Rejected. Retyping a lesson is copying, not the writing that helps memory, and it drove the agent to add material anyway.
- **Drop the rule.** Rejected. Material would arrive in bulk, unread, and the queue would fill with things the user never chose.
- **Grammar fields on Word (gender, plural, conjugation) so the App can make drills.** Rejected. Word serves every Topic, not only languages, and drills made by the App are material Lifeline originates.
- **Free writing prompts as a Knowledge type.** Rejected. Writing to be corrected is production, not retention: it happens in a Note or with the agent, and what the correction teaches is kept as Words and Sentences.

## Consequences

- Word, Sentence and Fact gain a draft state. Puzzles, Practice, the Due Card and Retention skip drafts as they skip paused material.
- The capture MCP tools (`knowledge_word`, `knowledge_sentence`, `knowledge_fact`) gain the draft mark and a Deck, and an agent's call always drafts.
- Practice may be narrowed to several Decks of one Topic, so lessons can be mixed.
