import { allIntakes, rememberIntake, useLastIntakeKey, type Handoff } from "@lifeline/core";
import { IntakeButton } from "@lifeline/ui";
import { APP_ID } from "../constants";

/**
 * "Hand off" (ADR 0050): Core's split button over every Intake it knows,
 * opening on the one last chosen from Pantry — how a running-low Provision
 * reaches the Shopping list (ADR 0055). Pantry names no receiver.
 */
export function HandOffMenu({ handoff }: { handoff: () => Handoff }) {
  const last = useLastIntakeKey(APP_ID);
  return (
    <IntakeButton
      intakes={allIntakes()}
      handoff={handoff}
      last={last}
      onChoose={(key) => rememberIntake(APP_ID, key)}
      className="text-amber-600 dark:text-amber-500"
    />
  );
}
