import { NotebookPenIcon, XIcon } from "lucide-react";
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
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
      <div
        role="note"
        aria-label="Where you left off"
        className="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-primary/24 bg-[color-mix(in_srgb,var(--popover)_94%,var(--primary))] px-4 py-3 text-popover-foreground shadow-lg ring-1 ring-black/8 dark:ring-white/8"
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
          onClick={() => dismissHandoffNote(threadKey)}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
