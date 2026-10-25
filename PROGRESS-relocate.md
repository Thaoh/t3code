# feat/relocate-project: upstream sync and split plan

Fork `Thaoh/t3code`, branch `feat/relocate-project` (head of closed pingdotgg/t3code#16504).

## Done

- Step 0: on `feat/relocate-project` at `7943cd8`. Added `upstream` (pingdotgg/t3code), fetched `upstream/main` at `90c455f`. Branch was 22 ahead, 2451 behind.
- Push check: `.forgejo/workflows/` absent. `.github/workflows/` runs on pushes to `main`, tags, PRs, `workflow_run`, schedule or dispatch only. A push to `feat/relocate-project` or `split/*` triggers nothing.
- Step 1: this file.
- Step 2: merged `upstream/main` (`90c455f`) as `bb2509a`. Ten conflicted files. Upstream shape kept:
  - `ProviderTurnStartService.ts`: upstream `settleStartFailure` (`Effect.fn`) and managed-worktree guard. Stranded check runs alongside: `stranded || (!exists && isManagedWorktreePath)`.
  - `MessagesTimeline.tsx` was split upstream; the "Open project settings" button moved to `TimelineWorkEntryRow.tsx`.
  - `ProjectSettingsPanel.tsx`: rebuilt on upstream's per-environment checkout rows and React Compiler style (no `useCallback`). The folder field replaces the path text in checkout rows.
  - `useThreadActionMenu.ts` / `useOpenProjectSettings.ts`: no manual memoization, as upstream.
  - Tests upstream deleted in #22557 (ProjectMutation, uiStateStore, session shutdown) stay deleted; only the relocate tests remain.
  - Turn-start stranded-worktree test now uses upstream's `worktreePath`/`fileSystem` harness inputs.
- Step 2 checks:
  - `vp run check:changed upstream/main`: format, lint, knip, typecheck (30 packages), tests (12 files, 355 tests) pass.
  - Server suite (`vp run --filter t3 test`): 4705 passed, 2 failed, 19 skipped. Both failures (`storageCleanup.test.ts` "compares the checked-out branch", `AcpSessionRuntime.processTree.test.ts` "preserves exact argv") fail the same way on plain `upstream/main` here: environment (git 2.56 / process setup), not the merge. `ServerBrowserPage.test.ts` needed Playwright's headless shell v1223, installed to `~/.cache/ms-playwright`.
  - Lint warnings left: 7 unused-var/style warnings in `ProviderTurnStartService.ts`, `ws.ts`, `GitVcsDriverCore.ts`, all present on upstream main.
  - `vp i` adds `@pnpm/exe` to `pnpm-lock.yaml` on this machine; reverted each time, never committed.

## Next

- Step 2 follow-up: full web suite run was cut off by a server restart; rerun.
- Step 3: split plan and `split/relocate-project-N` branches.
- Step 4: push `feat/relocate-project` and `split/*` to origin.

## Open questions

(none yet)
