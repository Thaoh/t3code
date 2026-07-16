import type { ScopedThreadRef, ThreadParkedNote } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useComposerDraftStore } from "./composerDraftStore";
import { createMemoryStorage } from "./lib/storage";

// Key predates the "thread parking" name — keeping it also resurrects notes
// saved by the localStorage-only builds of this feature.
export const THREAD_PARKING_STORAGE_KEY = "t3code:thread-handoff:v1";

export interface PendingParkingPrompt {
  threadRef: ScopedThreadRef;
  threadKey: string;
  threadTitle: string | null;
}

interface ThreadParkingStore {
  /** The thread the user just left and should be prompted about. */
  pendingPrompt: PendingParkingPrompt | null;
  /** Threads the user interacted with during the current visit. */
  interactedThreadKeys: Record<string, true>;
  /**
   * Persisted fallback notes for threads whose server cannot store them
   * (pre-parkedNote servers). Reconciled up to the server — latest
   * `createdAt` wins — once the environment advertises support.
   */
  localNotesByThreadKey: Record<string, ThreadParkedNote>;
  beginThreadVisit: (threadKey: string) => void;
  endThreadVisit: (threadRef: ScopedThreadRef, threadTitle: string | null) => void;
  markThreadInteraction: (threadKey: string) => void;
  skipParkingPrompt: () => void;
  setLocalNote: (threadKey: string, note: ThreadParkedNote) => void;
  clearLocalNote: (threadKey: string) => void;
}

/**
 * Pick the note to display when a thread has both a server-synced note and a
 * local fallback note: the most recently created one wins.
 */
export function resolveDisplayedParkedNote(
  serverNote: ThreadParkedNote | null,
  localNote: ThreadParkedNote | null,
): ThreadParkedNote | null {
  if (serverNote === null) {
    return localNote;
  }
  if (localNote === null) {
    return serverNote;
  }
  return localNote.createdAt > serverNote.createdAt ? localNote : serverNote;
}

/**
 * A local note should be pushed to a parking-capable server only when it is
 * newer than whatever the server already has; otherwise the server note wins
 * and the local copy can be dropped.
 */
export function shouldPushLocalNote(
  serverNote: ThreadParkedNote | null,
  localNote: ThreadParkedNote,
): boolean {
  return serverNote === null || localNote.createdAt > serverNote.createdAt;
}

function sanitizeLocalNotes(value: unknown): Record<string, ThreadParkedNote> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const notes: Record<string, ThreadParkedNote> = {};
  for (const [threadKey, note] of Object.entries(value)) {
    if (!threadKey || !note || typeof note !== "object") {
      continue;
    }
    const candidate = note as Partial<ThreadParkedNote>;
    if (
      typeof candidate.goal !== "string" ||
      typeof candidate.nextStep !== "string" ||
      typeof candidate.createdAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.createdAt))
    ) {
      continue;
    }
    notes[threadKey] = {
      goal: candidate.goal,
      nextStep: candidate.nextStep,
      createdAt: candidate.createdAt,
    };
  }
  return notes;
}

export const useThreadParkingStore = create<ThreadParkingStore>()(
  persist(
    (set) => ({
      pendingPrompt: null,
      interactedThreadKeys: {},
      localNotesByThreadKey: {},
      beginThreadVisit: (threadKey) =>
        set((state) => {
          // Returning to the thread the pending prompt is about closes the
          // hook naturally — drop the prompt instead of asking about it.
          if (state.pendingPrompt?.threadKey !== threadKey) {
            return state;
          }
          return { pendingPrompt: null };
        }),
      endThreadVisit: (threadRef, threadTitle) =>
        set((state) => {
          const threadKey = scopedThreadKey(threadRef);
          if (state.interactedThreadKeys[threadKey] !== true) {
            return state;
          }
          const interactedThreadKeys = { ...state.interactedThreadKeys };
          delete interactedThreadKeys[threadKey];
          return {
            interactedThreadKeys,
            pendingPrompt: { threadRef, threadKey, threadTitle },
          };
        }),
      markThreadInteraction: (threadKey) =>
        set((state) => {
          if (state.interactedThreadKeys[threadKey] === true) {
            return state;
          }
          return {
            interactedThreadKeys: { ...state.interactedThreadKeys, [threadKey]: true },
          };
        }),
      skipParkingPrompt: () =>
        set((state) => (state.pendingPrompt === null ? state : { pendingPrompt: null })),
      setLocalNote: (threadKey, note) =>
        set((state) => ({
          localNotesByThreadKey: { ...state.localNotesByThreadKey, [threadKey]: note },
        })),
      clearLocalNote: (threadKey) =>
        set((state) => {
          if (!(threadKey in state.localNotesByThreadKey)) {
            return state;
          }
          const localNotesByThreadKey = { ...state.localNotesByThreadKey };
          delete localNotesByThreadKey[threadKey];
          return { localNotesByThreadKey };
        }),
    }),
    {
      name: THREAD_PARKING_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() =>
        typeof localStorage !== "undefined" ? localStorage : createMemoryStorage(),
      ),
      partialize: (state) => ({ localNotesByThreadKey: state.localNotesByThreadKey }),
      migrate: (persisted) => {
        // v1 stored display notes under `notesByThreadKey` (with an extra
        // threadTitle field) before notes moved server-side; adopt them as
        // local fallback notes.
        const legacy = persisted as
          | { localNotesByThreadKey?: unknown; notesByThreadKey?: unknown }
          | undefined;
        return {
          localNotesByThreadKey: sanitizeLocalNotes(
            legacy?.localNotesByThreadKey ?? legacy?.notesByThreadKey,
          ),
        };
      },
      merge: (persisted, current) => ({
        ...current,
        localNotesByThreadKey: sanitizeLocalNotes(
          (persisted as { localNotesByThreadKey?: unknown } | undefined)?.localNotesByThreadKey,
        ),
      }),
    },
  ),
);

/**
 * Tracks the active thread visit so a parking prompt fires when the user
 * switches away from a thread they interacted with (sent a message or typed
 * in the composer during this visit).
 *
 * Mount this once in a layout that survives thread navigation (not per-thread
 * views): leaves are detected as route-key transitions rather than unmount
 * cleanup, so StrictMode double-effects and remount churn during draft-thread
 * promotion never register phantom visits.
 */
export function useThreadParkingTracking(
  threadRef: ScopedThreadRef | null,
  threadTitle: string | null,
): void {
  const beginThreadVisit = useThreadParkingStore((store) => store.beginThreadVisit);
  const endThreadVisit = useThreadParkingStore((store) => store.endThreadVisit);
  const markThreadInteraction = useThreadParkingStore((store) => store.markThreadInteraction);
  const threadKey = threadRef ? scopedThreadKey(threadRef) : null;

  const composerPrompt = useComposerDraftStore((store) =>
    threadRef ? (store.getComposerDraft(threadRef)?.prompt ?? "") : "",
  );

  const titleRef = useRef(threadTitle);
  titleRef.current = threadTitle;
  const promptRef = useRef(composerPrompt);
  promptRef.current = composerPrompt;
  const activeVisitRef = useRef<{
    threadKey: string;
    threadRef: ScopedThreadRef;
    title: string | null;
  } | null>(null);
  const visitBaselinePromptRef = useRef<string | null>(null);

  // Thread titles usually arrive after the visit starts (generated from the
  // first message) — keep the tracked visit's title fresh.
  useEffect(() => {
    if (activeVisitRef.current && activeVisitRef.current.threadKey === threadKey) {
      activeVisitRef.current.title = threadTitle;
    }
  });

  useEffect(() => {
    const previousVisit = activeVisitRef.current;
    if (previousVisit?.threadKey === threadKey) {
      return;
    }
    if (previousVisit) {
      endThreadVisit(previousVisit.threadRef, previousVisit.title);
    }
    if (threadKey && threadRef) {
      beginThreadVisit(threadKey);
      activeVisitRef.current = { threadKey, threadRef, title: titleRef.current };
      visitBaselinePromptRef.current = promptRef.current;
    } else {
      activeVisitRef.current = null;
      visitBaselinePromptRef.current = null;
    }
    // A recreated-but-equal threadRef is harmless: the early return above
    // keys the visit on threadKey.
  }, [beginThreadVisit, endThreadVisit, threadKey, threadRef]);

  // Typing in the composer counts as interaction: compare against the draft
  // prompt captured when this visit started. This effect is declared after the
  // visit-transition effect so the baseline is re-captured before comparing.
  useEffect(() => {
    if (
      threadKey &&
      activeVisitRef.current?.threadKey === threadKey &&
      visitBaselinePromptRef.current !== null &&
      composerPrompt !== visitBaselinePromptRef.current
    ) {
      markThreadInteraction(threadKey);
    }
  }, [composerPrompt, markThreadInteraction, threadKey]);
}
