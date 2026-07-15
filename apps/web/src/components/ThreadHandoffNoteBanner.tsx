import { XIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useThreadHandoffStore } from "../threadHandoffStore";

/**
 * Floating recap of the handoff note captured when the user last left this
 * thread. Hovers above the chat until dismissed.
 */
export function ThreadHandoffNoteBanner({ threadKey }: { threadKey: string }) {
  const note = useThreadHandoffStore((store) => store.notesByThreadKey[threadKey] ?? null);
  const dismissHandoffNote = useThreadHandoffStore((store) => store.dismissHandoffNote);

  if (!note) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-4">
      <div
        role="note"
        aria-label="Where you left off"
        className="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-card-foreground shadow-lg/5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Where you left off
          </span>
          {note.goal ? (
            <p className="min-w-0 break-words">
              <span className="text-muted-foreground">Trying to do: </span>
              {note.goal}
            </p>
          ) : null}
          {note.nextStep ? (
            <p className="min-w-0 break-words">
              <span className="text-muted-foreground">Next step: </span>
              {note.nextStep}
            </p>
          ) : null}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss note"
          className="-mr-1.5 -mt-1 shrink-0"
          onClick={() => dismissHandoffNote(threadKey)}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
