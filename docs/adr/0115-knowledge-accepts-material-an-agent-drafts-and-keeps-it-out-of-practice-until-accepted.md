---
status: accepted
amends: ADR 0073 (in part — an agent may draft material, and Knowledge reports practice to it), ADR 0062 (in part — a read-only Command, who invokes a Command, and an App refusing an agent's edit)
---

# Knowledge accepts material an agent drafts, and keeps it out of practice until accepted

ADR 0073 kept acquisition out of Lifeline. CONTEXT.md went further: nothing is phrased for the user, and an agent may add only what the user dictates word for word. In practice an agent outside Lifeline (ADR 0091) is teaching the user, a language mostly. It writes lessons and wants to keep their material, and it chooses the next lesson from what the user gets wrong. The rule made that agent either break it or hand everything back to be retyped. And it could not see a single Recall, because Recalls are internal Documents and the MCP server hides those.

So:

- **An agent may draft.** A Word, Sentence or Fact may be a **draft**: listed, editable, but out of every Practice, Puzzle, Retention and report until the user **accepts** it. Drafting is not adding: a draft says what was drafted and by whom in its origin, and that mark stays after acceptance, so the user's own material and the agent's stay apart.
- **Acceptance is the user's.** One at a time (accept, edit then accept, or delete), or a whole Deck at once after every item has been shown. A draft enters practice as new when it is accepted, and the daily new cap counts it from then.
- **An agent may make and fill Decks.** A lesson is a Deck. An agent never changes accepted material: it proposes a rewrite, which arrives as a draft change the user accepts or discards. It never pauses, unpauses or deletes.
- **Knowledge reports practice, read-only.** A headless `knowledge.report` Command, which an agent calls as the `knowledge_report` tool, returns, per Topic or Deck: Retention, the Leeches and the Prompts failed most in the last 30 days with their latest Recalls (typed attempts included, ADR 0116), and what is due. Lifeline still decides nothing about what comes next. The agent outside does.
- **Unchanged.** Lifeline itself drafts nothing: no generated drills, no dictionary, no grammar fields that would let it derive material. Nothing enters practice unchosen. Grammar a user wants drilled is written as Sentences.

## What this asks of Core (amends ADR 0062)

ADR 0062 routes every App operation through a headless Command, and made every Command a write. Three hooks let Knowledge keep to that:

- **A Command may be read-only** (`readOnly`). Its `invoke` changes nothing and answers in `CommandResult.data`; its tool is a read tool, so a read-only grant still offers it, and `about` tells the agent what it answers. The report is one, so the MCP server stays generic and imports no App.
- **A Command knows who runs it.** `invoke` receives an `InvokeContext`; `agent` is set when an outside agent calls through MCP, and a Macro an agent runs hands it to each step. Knowledge drafts whatever an agent adds.
- **A type may refuse an agent's edit** (`agentEditRefusal` on its DocumentTypeDef). `update_document` asks it first and returns its reason; the App's own Commands and the user's edits are never asked. Knowledge refuses edits to accepted material, which arrive as a draft change instead.

## Considered options

- **A `knowledge_report` tool among the MCP server's generic tools.** Rejected. It made the generic server import an App and answer for its data, which ADR 0062 keeps in the App's Commands; it was there only because every Command tool was a write.

- **Keep the rule; the user retypes what the agent taught.** Rejected. Retyping a lesson is copying, not the writing that helps memory, and it drove the agent to add material anyway.
- **Drop the rule.** Rejected. Material would arrive in bulk, unread, and the queue would fill with things the user never chose.
- **Grammar fields on Word (gender, plural, conjugation) so the App can make drills.** Rejected. Word serves every Topic, not only languages, and drills made by the App are material Lifeline originates.
- **Free writing prompts as a Knowledge type.** Rejected. Writing to be corrected is production, not retention: it happens in a Note or with the agent, and what the correction teaches is kept as Words and Sentences.

## Consequences

- Word, Sentence and Fact gain a draft state. Puzzles, Practice, the Due Card and Retention skip drafts as they skip paused material.
- The capture MCP tools (`knowledge_word`, `knowledge_sentence`, `knowledge_fact`) gain the draft mark and a Deck, and an agent's call always drafts.
- Practice may be narrowed to several Decks of one Topic, so lessons can be mixed.
