import { useState } from "react";
import { Button, EmptyState, Page, PageHeader } from "@lifeline/ui";
import { UserPlus } from "lucide-react";
import { AddPersonDialog } from "../components/AddPersonDialog";

/**
 * Where the People Module lands, for now: a placeholder until its home —
 * Upcoming, Drifting and Everyone — is built (#409). People are reached from
 * their links, the palette and the People Base meanwhile.
 */
export function PeopleScreen() {
  const [adding, setAdding] = useState(false);
  return (
    <Page>
      <PageHeader title="People" />
      <EmptyState
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> Add person
          </Button>
        }
      >
        The people in your life. Add someone, then link them from any page with [[their name]].
      </EmptyState>
      <AddPersonDialog open={adding} onOpenChange={setAdding} />
    </Page>
  );
}
