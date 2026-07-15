import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { useComposerDraftStore } from "./composerDraftStore";

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
  beginThreadVisit: (threadKey: string) => void;
  endThreadVisit: (threadRef: ScopedThreadRef, threadTitle: string | null) => void;
  markThreadInteraction: (threadKey: string) => void;
  skipParkingPrompt: () => void;
}

export const useThreadParkingStore = create<ThreadParkingStore>((set) => ({
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
}));

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
