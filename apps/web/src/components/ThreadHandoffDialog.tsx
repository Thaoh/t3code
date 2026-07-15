import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { useThreadHandoffStore } from "../threadHandoffStore";

function ThreadHandoffForm({ threadTitle }: { threadTitle: string | null }) {
  const submitHandoffNote = useThreadHandoffStore((store) => store.submitHandoffNote);
  const skipHandoffPrompt = useThreadHandoffStore((store) => store.skipHandoffPrompt);
  const [goal, setGoal] = useState("");
  const [nextStep, setNextStep] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitHandoffNote({ goal, nextStep });
      }}
      className="contents"
    >
      <DialogHeader>
        <DialogTitle>Park your last thread</DialogTitle>
        <DialogDescription>
          {threadTitle
            ? `Leave a note for “${threadTitle}” so you can pick it back up without re-loading it in your head.`
            : "Leave a note for the thread you just left so you can pick it back up without re-loading it in your head."}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-3">
        <Textarea
          aria-label="What were you trying to do?"
          placeholder="What were you trying to do?"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          autoFocus
          size="sm"
        />
        <Textarea
          aria-label="What is the next step?"
          placeholder="What is the next step?"
          value={nextStep}
          onChange={(event) => setNextStep(event.target.value)}
          size="sm"
        />
      </DialogPanel>
      <DialogFooter variant="bare">
        <Button type="button" variant="ghost" onClick={skipHandoffPrompt}>
          Skip
        </Button>
        <Button type="submit" disabled={goal.trim().length === 0 && nextStep.trim().length === 0}>
          Save note
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Attention-residue capture: when the user switches away from a thread they
 * were working in, ask what they were doing and what comes next. The answers
 * float above the chat when they return to that thread.
 */
export function ThreadHandoffDialog() {
  const pendingPrompt = useThreadHandoffStore((store) => store.pendingPrompt);
  const skipHandoffPrompt = useThreadHandoffStore((store) => store.skipHandoffPrompt);

  return (
    <Dialog
      open={pendingPrompt !== null}
      onOpenChange={(open) => {
        if (!open) {
          skipHandoffPrompt();
        }
      }}
    >
      {pendingPrompt !== null ? (
        <DialogPopup showCloseButton={false}>
          <ThreadHandoffForm
            key={pendingPrompt.threadKey}
            threadTitle={pendingPrompt.threadTitle}
          />
        </DialogPopup>
      ) : null}
    </Dialog>
  );
}
