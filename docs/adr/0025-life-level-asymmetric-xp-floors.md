# Life Level: asymmetric XP floors — decay stops at zero, negatives dig debt

Ported with the Life Level App (originally life-level's ADR 0001; readopted unchanged in the merge). Raw XP is the signed, derived measure of a Habit's progress, and two forces reduce it — idle **decay** and **Negative-activity** damage — but they are deliberately *not* symmetric. Decay can never push Raw XP below zero (once Raw XP ≤ 0, decay stops applying), whereas a Negative *can* drive it into debt below zero, forcing the user to climb back out before progress resumes. Level is floored at 1 in both cases.

The two punishments mean different things: idleness erodes progress you stopped maintaining but never *buries* you — the punishment for not showing up is losing ground, not accumulating debt — while your own bad acts are the only thing allowed to put you in a hole. Slower future progress is a consequence of deliberate harm, not mere absence.

## Consequences

A future reader will see both decay and negatives subtracting from the same derived Raw XP and may be tempted to "simplify" them into one uniform path (both clamping at zero, or neither). That would erase the intended asymmetry. The zero-clamp must stay decay-specific; the below-zero debt must stay negatives-specific.
