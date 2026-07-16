import { useState } from "react";
import type { ScopedThreadRef } from "@t3tools/contracts";
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
import { useClientSettings } from "../hooks/useSettings";
import { useServerConfigs } from "../state/entities";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import { useThreadParkingStore } from "../threadParkingStore";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";

function ThreadParkingForm({
  threadRef,
  threadTitle,
}: {
  threadRef: ScopedThreadRef;
  threadTitle: string | null;
}) {
  const skipParkingPrompt = useThreadParkingStore((store) => store.skipParkingPrompt);
  const setLocalNote = useThreadParkingStore((store) => store.setLocalNote);
  const serverConfigs = useServerConfigs();
  const serverSupportsParking =
    serverConfigs.get(threadRef.environmentId)?.environment.capabilities.threadParkingNotes ===
    true;
  const updateThreadMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const [goal, setGoal] = useState("");
  const [nextStep, setNextStep] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmedGoal = goal.trim();
        const trimmedNextStep = nextStep.trim();
        if (trimmedGoal || trimmedNextStep) {
          const parkedNote = {
            goal: trimmedGoal,
            nextStep: trimmedNextStep,
            createdAt: new Date().toISOString(),
          };
          if (serverSupportsParking) {
            void updateThreadMetadata({
              environmentId: threadRef.environmentId,
              input: {
                threadId: threadRef.threadId,
                parkedNote,
              },
            });
          } else {
            // Server predates synced parking notes — keep the note on this
            // device; it reconciles up once the server advertises support.
            setLocalNote(scopedThreadKey(threadRef), parkedNote);
          }
        }
        skipParkingPrompt();
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
        <Button type="button" variant="ghost" onClick={skipParkingPrompt}>
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
 * are stored on the thread server-side, so they follow the user to any
 * connected client and float above the chat when they return.
 */
export function ThreadParkingDialog() {
  const threadParkingNotes = useClientSettings((settings) => settings.threadParkingNotes);
  const pendingPrompt = useThreadParkingStore((store) => store.pendingPrompt);
  const skipParkingPrompt = useThreadParkingStore((store) => store.skipParkingPrompt);

  if (!threadParkingNotes) {
    return null;
  }

  return (
    <Dialog
      open={pendingPrompt !== null}
      onOpenChange={(open) => {
        if (!open) {
          skipParkingPrompt();
        }
      }}
    >
      {pendingPrompt !== null ? (
        <DialogPopup showCloseButton={false}>
          <ThreadParkingForm
            key={pendingPrompt.threadKey}
            threadRef={pendingPrompt.threadRef}
            threadTitle={pendingPrompt.threadTitle}
          />
        </DialogPopup>
      ) : null}
    </Dialog>
  );
}
