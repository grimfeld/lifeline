---
status: accepted
amends: ADR 0058 (in part — a Recall may carry a typed attempt; a clip adds a listening Prompt), ADR 0037 (in part — a clip's Attachment is deleted by its item, not by the cleanup Command)
---

# A Recall keeps what was typed, and a clip gives a listening Prompt

A Recall was recalled in the head, revealed, and graded pass or fail by the user: never typed, never checked. That trains recognition well and production poorly, and it left no trace of *what* went wrong. For a French speaker learning Italian, that trace (*a la stazione*, *i amici*) is the thing worth seeing. Nor could material be heard, though listening is a goal on its own.

So:

- **Typing is offered, never required, and never graded by the App.** On a Prompt whose answer is short and exact (a Word's reverse, a Sentence's blank, a listening Prompt), the user may type before revealing. The reveal shows what was typed beside the answer, and the user still grades pass or fail. A forward Word and a Fact stay reveal-only: a paraphrased meaning compared character by character would mislead.
- **The Recall keeps the typed attempt** as part of the fact, unchanged afterwards. It is what `knowledge_report` (ADR 0115) shows an agent, so error patterns are diagnosed outside Lifeline. Lifeline keeps no mistake labels.
- **A Word or Sentence may carry an audio clip**, recorded in its dialog or attached as a file, and played on reveal. While it has one, it yields a **listening** Prompt: hear it, recall the term and meaning (Word) or the whole text (Sentence). The slot is `listen`, whatever the clip, so a re-recording keeps the schedule. Removing the clip removes the Prompt; its Recalls stay and count for nothing until a clip is back.
- **A blank may carry a hint**, `{{nel|in}}`, shown in the gap. The slot is keyed on the answer before `|`, so adding or changing a hint never resets the blank. A blank has one answer. An equally right alternative goes in the Sentence's notes, which every reveal shows.

## Considered options

- **The App checks typed answers.** Rejected. It needs every accepted answer listed (*in centro*, *nel centro*), punishes a typo like a mistake, and moves the grade away from the user.
- **Mistake labels picked after a fail.** Deferred. They add friction to every fail, and the typed attempt already carries the evidence. Labels can come later if reading attempts proves too vague.
- **Speech synthesis instead of clips.** Rejected for now. A synthetic voice is weakest on what needs hearing most (double consonants, *gli*, *gn*), and a clip from a real speaker or a film is the material the user met.
- **Alternatives inside a blank, `{{nel centro / in centro}}`.** Rejected. Under self-grading an alternative only needs to be seen, and the notes already reach the reveal.

## Consequences

- The Recall type gains an optional `typed` text; Word and Sentence gain an optional clip; Sentence gains notes.
- The listening Prompt is a new slot in each type's Recallable declaration; a Topic's daily new cap counts it like any other.
- An agent cannot add clips through MCP.
- **A clip lives exactly as long as its item** and departs from ADR 0037 in that: orphan cleanup skips audio, and the Word or Sentence that holds the clip's id deletes it, not the cleanup Command. Replacing or removing the clip on Save deletes the old Attachment; deleting the item deletes it with the cascade.
- **Undo keeps the clip.** Deleting a draft in Deck review holds its clip while the Undo toast is open: Undo restores the draft with it, and the clip is deleted only once the toast closes.
- **A clip stored and never kept is swept.** The dialog stores a recording at once (so it can be heard before Save) and deletes what Save did not keep, but a closed tab skips that. Opening Knowledge therefore deletes any audio Attachment that no Word or Sentence holds and is over a day old (the day leaves an open dialog alone). It waits for the first pull of documents and attachments, and counts clips held by Private or other-Workspace items too, so a Word it cannot see still keeps its clip.
- **Video containers are for clips only.** The file field accepts `video/webm` and `video/mp4` because PocketBase sniffs an audio-only WebM or MP4 as video; a create hook (`attachments.pb.js`) refuses a video upload whose declared `mime` is not `audio/*`.
