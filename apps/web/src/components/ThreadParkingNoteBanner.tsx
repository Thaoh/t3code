import { useEffect } from "react";
import { NotebookPenIcon, XIcon } from "lucide-react";
import type { ScopedThreadRef, ThreadParkedNote } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { Button } from "~/components/ui/button";
import { useClientSettings } from "../hooks/useSettings";
import { useServerConfigs } from "../state/entities";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import {
  resolveDisplayedParkedNote,
  shouldPushLocalNote,
  useThreadParkingStore,
} from "../threadParkingStore";

/**
 * Floating recap of the parked note captured when the user last left this
 * thread. Hovers above the chat until dismissed.
 *
 * Notes live on the thread server-side when the environment supports it;
 * notes captured against older servers are stored on this device and shown
 * the same way. When both exist the most recent wins, and a local note is
 * pushed up (then dropped) once the server advertises parking support.
 */
export function ThreadParkingNoteBanner({
  threadRef,
  parkedNote,
}: {
  threadRef: ScopedThreadRef;
  parkedNote: ThreadParkedNote | null;
}) {
  const threadParkingNotes = useClientSettings((settings) => settings.threadParkingNotes);
  const threadKey = scopedThreadKey(threadRef);
  const localNote = useThreadParkingStore(
    (store) => store.localNotesByThreadKey[threadKey] ?? null,
  );
  const clearLocalNote = useThreadParkingStore((store) => store.clearLocalNote);
  const serverConfigs = useServerConfigs();
  const serverSupportsParking =
    serverConfigs.get(threadRef.environmentId)?.environment.capabilities.threadParkingNotes ===
    true;
  const updateThreadMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });

  // Reconcile a local fallback note once the server can hold it: push the
  // local note when it is the newest, otherwise the server note wins and the
  // local copy is dropped.
  useEffect(() => {
    if (!threadParkingNotes || !serverSupportsParking || localNote === null) {
      return;
    }
    if (!shouldPushLocalNote(parkedNote, localNote)) {
      clearLocalNote(threadKey);
      return;
    }
    let cancelled = false;
    void updateThreadMetadata({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId, parkedNote: localNote },
    }).then((result) => {
      if (!cancelled && result._tag === "Success") {
        clearLocalNote(threadKey);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    clearLocalNote,
    localNote,
    parkedNote,
    serverSupportsParking,
    threadKey,
    threadParkingNotes,
    threadRef.environmentId,
    threadRef.threadId,
    updateThreadMetadata,
  ]);

  const note = resolveDisplayedParkedNote(parkedNote, localNote);

  if (!threadParkingNotes || !note) {
    return null;
  }

  const dismissNote = () => {
    clearLocalNote(threadKey);
    if (parkedNote !== null && serverSupportsParking) {
      void updateThreadMetadata({
        environmentId: threadRef.environmentId,
        input: { threadId: threadRef.threadId, parkedNote: null },
      });
    }
  };

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
          {note.goal ? (
            <p className="min-w-0 break-words text-muted-foreground">
              Trying to do: <span className="text-foreground">{note.goal}</span>
            </p>
          ) : null}
          {note.nextStep ? (
            <p className="min-w-0 break-words text-muted-foreground">
              Next step: <span className="text-foreground">{note.nextStep}</span>
            </p>
          ) : null}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss note"
          className="-mr-1.5 -mt-1 shrink-0"
          onClick={dismissNote}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
