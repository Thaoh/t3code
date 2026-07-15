import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useComposerDraftStore } from "./composerDraftStore";
import { createMemoryStorage } from "./lib/storage";

export const THREAD_HANDOFF_STORAGE_KEY = "t3code:thread-handoff:v1";

export interface ThreadHandoffNote {
  goal: string;
  nextStep: string;
  threadTitle: string | null;
  createdAt: string;
}

export interface PendingHandoffPrompt {
  threadKey: string;
  threadTitle: string | null;
}

interface ThreadHandoffState {
  /** Persisted: submitted handoff notes, keyed by scoped thread key. */
  notesByThreadKey: Record<string, ThreadHandoffNote>;
  /** Session-only: the thread the user just left and should be prompted about. */
  pendingPrompt: PendingHandoffPrompt | null;
  /** Session-only: threads the user interacted with during the current visit. */
  interactedThreadKeys: Record<string, true>;
}

interface ThreadHandoffStore extends ThreadHandoffState {
  beginThreadVisit: (threadKey: string) => void;
  endThreadVisit: (threadKey: string, threadTitle: string | null) => void;
  markThreadInteraction: (threadKey: string) => void;
  submitHandoffNote: (note: { goal: string; nextStep: string }) => void;
  skipHandoffPrompt: () => void;
  dismissHandoffNote: (threadKey: string) => void;
}

function sanitizeNotes(value: unknown): Record<string, ThreadHandoffNote> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const notes: Record<string, ThreadHandoffNote> = {};
  for (const [threadKey, note] of Object.entries(value)) {
    if (!threadKey || !note || typeof note !== "object") {
      continue;
    }
    const candidate = note as Partial<ThreadHandoffNote>;
    if (typeof candidate.goal !== "string" || typeof candidate.nextStep !== "string") {
      continue;
    }
    notes[threadKey] = {
      goal: candidate.goal,
      nextStep: candidate.nextStep,
      threadTitle: typeof candidate.threadTitle === "string" ? candidate.threadTitle : null,
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    };
  }
  return notes;
}

export const useThreadHandoffStore = create<ThreadHandoffStore>()(
  persist(
    (set) => ({
      notesByThreadKey: {},
      pendingPrompt: null,
      interactedThreadKeys: {},
      beginThreadVisit: (threadKey) =>
        set((state) => {
          // Returning to the thread the pending prompt is about closes the
          // hook naturally — drop the prompt instead of asking about it.
          if (state.pendingPrompt?.threadKey !== threadKey) {
            return state;
          }
          return { pendingPrompt: null };
        }),
      endThreadVisit: (threadKey, threadTitle) =>
        set((state) => {
          if (state.interactedThreadKeys[threadKey] !== true) {
            return state;
          }
          const interactedThreadKeys = { ...state.interactedThreadKeys };
          delete interactedThreadKeys[threadKey];
          return {
            interactedThreadKeys,
            pendingPrompt: { threadKey, threadTitle },
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
      submitHandoffNote: ({ goal, nextStep }) =>
        set((state) => {
          const prompt = state.pendingPrompt;
          if (!prompt) {
            return state;
          }
          const trimmedGoal = goal.trim();
          const trimmedNextStep = nextStep.trim();
          if (!trimmedGoal && !trimmedNextStep) {
            return { pendingPrompt: null };
          }
          return {
            pendingPrompt: null,
            notesByThreadKey: {
              ...state.notesByThreadKey,
              [prompt.threadKey]: {
                goal: trimmedGoal,
                nextStep: trimmedNextStep,
                threadTitle: prompt.threadTitle,
                createdAt: new Date().toISOString(),
              },
            },
          };
        }),
      skipHandoffPrompt: () =>
        set((state) => (state.pendingPrompt === null ? state : { pendingPrompt: null })),
      dismissHandoffNote: (threadKey) =>
        set((state) => {
          if (!(threadKey in state.notesByThreadKey)) {
            return state;
          }
          const notesByThreadKey = { ...state.notesByThreadKey };
          delete notesByThreadKey[threadKey];
          return { notesByThreadKey };
        }),
    }),
    {
      name: THREAD_HANDOFF_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        typeof localStorage !== "undefined" ? localStorage : createMemoryStorage(),
      ),
      partialize: (state) => ({ notesByThreadKey: state.notesByThreadKey }),
      merge: (persisted, current) => ({
        ...current,
        notesByThreadKey: sanitizeNotes(
          (persisted as Partial<ThreadHandoffState> | undefined)?.notesByThreadKey,
        ),
      }),
    },
  ),
);

/**
 * Tracks the active thread visit so a handoff prompt fires when the user
 * switches away from a thread they interacted with (sent a message or typed
 * in the composer during this visit).
 *
 * Mount this once in a layout that survives thread navigation (not per-thread
 * views): leaves are detected as route-key transitions rather than unmount
 * cleanup, so StrictMode double-effects and remount churn during draft-thread
 * promotion never register phantom visits.
 */
export function useThreadHandoffTracking(
  threadRef: ScopedThreadRef | null,
  threadTitle: string | null,
): void {
  const beginThreadVisit = useThreadHandoffStore((store) => store.beginThreadVisit);
  const endThreadVisit = useThreadHandoffStore((store) => store.endThreadVisit);
  const markThreadInteraction = useThreadHandoffStore((store) => store.markThreadInteraction);
  const threadKey = threadRef ? scopedThreadKey(threadRef) : null;

  const composerPrompt = useComposerDraftStore((store) =>
    threadRef ? (store.getComposerDraft(threadRef)?.prompt ?? "") : "",
  );

  const titleRef = useRef(threadTitle);
  titleRef.current = threadTitle;
  const promptRef = useRef(composerPrompt);
  promptRef.current = composerPrompt;
  const activeVisitRef = useRef<{ threadKey: string; title: string | null } | null>(null);
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
      endThreadVisit(previousVisit.threadKey, previousVisit.title);
    }
    if (threadKey) {
      beginThreadVisit(threadKey);
      activeVisitRef.current = { threadKey, title: titleRef.current };
      visitBaselinePromptRef.current = promptRef.current;
    } else {
      activeVisitRef.current = null;
      visitBaselinePromptRef.current = null;
    }
  }, [beginThreadVisit, endThreadVisit, threadKey]);

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
