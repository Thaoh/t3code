import { NotebookPenIcon, XIcon } from "lucide-react";
import type { ScopedThreadRef, ThreadParkedNote } from "@t3tools/contracts";
import { Button } from "~/components/ui/button";
import { useClientSettings } from "../hooks/useSettings";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";

/**
 * Floating recap of the parked note captured when the user last left this
 * thread. Hovers above the chat until dismissed; the note lives on the
 * thread server-side, so dismissing it clears it for every client.
 */
export function ThreadParkingNoteBanner({
  threadRef,
  parkedNote,
}: {
  threadRef: ScopedThreadRef;
  parkedNote: ThreadParkedNote | null;
}) {
  const threadParkingNotes = useClientSettings((settings) => settings.threadParkingNotes);
  const updateThreadMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });

  if (!threadParkingNotes || !parkedNote) {
    return null;
  }

  return (
    // In flow above the chat by default so it never covers messages; on chat
    // columns wide enough for the timeline's side gutter to fit the card
    // (max-w-3xl content + w-80 card + margins), float it in the right gutter.
    <div className="z-30 flex shrink-0 justify-center px-4 pt-3 @min-[92rem]:absolute @min-[92rem]:top-3 @min-[92rem]:right-4 @min-[92rem]:block @min-[92rem]:w-80 @min-[92rem]:p-0">
      <div
        role="note"
        aria-label="Where you left off"
        className="flex w-full max-w-xl items-start gap-3 rounded-xl border border-primary/24 bg-[color-mix(in_srgb,var(--popover)_94%,var(--primary))] px-4 py-3 text-popover-foreground shadow-lg ring-1 ring-black/8 @min-[92rem]:max-w-none dark:ring-white/8"
      >
        <NotebookPenIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">Where you left off</span>
          {parkedNote.goal ? (
            <p className="min-w-0 break-words text-muted-foreground">
              Trying to do: <span className="text-foreground">{parkedNote.goal}</span>
            </p>
          ) : null}
          {parkedNote.nextStep ? (
            <p className="min-w-0 break-words text-muted-foreground">
              Next step: <span className="text-foreground">{parkedNote.nextStep}</span>
            </p>
          ) : null}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss note"
          className="-mr-1.5 -mt-1 shrink-0"
          onClick={() =>
            void updateThreadMetadata({
              environmentId: threadRef.environmentId,
              input: { threadId: threadRef.threadId, parkedNote: null },
            })
          }
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
