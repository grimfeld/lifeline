import { Button } from "@lifeline/ui";
import { Loader2 } from "lucide-react";
import { SignInFields, useSignIn } from "../components/AccountDialogs";

/**
 * The Handoff page's sign-in step, where the Intake step would be when this
 * device is signed out: sign in and carry on with the same Handoff, or work
 * locally — what the Intake saves then stays on this device until a sign-in
 * syncs it, as it would anywhere else in Lifeline.
 */
export function HandoffSignIn({ onDone }: { onDone: () => void }) {
  const form = useSignIn(onDone);
  return (
    <section className="grid max-w-sm gap-3" aria-labelledby="handoff-sign-in">
      <div className="grid gap-1">
        <h2 id="handoff-sign-in" className="text-muted-foreground text-sm font-medium">
          Sign in to keep this
        </h2>
        <p className="text-muted-foreground text-sm">You're signed out on this device. Sign in and it opens ready to save.</p>
      </div>
      <SignInFields form={form} idPrefix="handoff-login" />
      <div className="flex flex-wrap gap-2">
        <Button className="max-md:flex-1" disabled={form.busy} onClick={() => void form.submit()}>
          {form.busy && <Loader2 className="animate-spin" />} Sign in
        </Button>
        <Button className="max-md:flex-1" variant="outline" onClick={onDone}>
          Work locally
        </Button>
      </div>
    </section>
  );
}
