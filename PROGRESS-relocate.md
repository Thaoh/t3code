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

- Step 2 follow-up: full web suite on `feat/relocate-project`: 347 files, all tests pass. Two worker processes segfaulted (Node v26) in `useThreadActions.permissions.test.ts` and `ProviderUpdateLaunchNotification.logic.test.ts`; both pass on re-run (45 tests).
- Step 3: split into three stacked local branches. The top one has the same tree as `feat/relocate-project` minus this file. Line counts: raw = additions + deletions including tests; effective = the `pr-size` workflow rule (tests excluded, whitespace ignored).

  | Branch                               | Base            | Raw | Effective | Check                                                                                     |
  | ------------------------------------ | --------------- | --- | --------- | ----------------------------------------------------------------------------------------- |
  | `split/relocate-project-1` `4704f9d` | `upstream/main` | 232 | 125       | `check:changed upstream/main`: pass, 7 test files, 305 tests                              |
  | `split/relocate-project-2` `41b53e4` | split-1         | 318 | 270       | `check:changed split-1`: pass, 3 files, 31 tests; panel browser test + store test 28 pass |
  | `split/relocate-project-3` `9c983d2` | split-2         | 151 | 124       | `check:changed split-2`: pass, typecheck 30 packages, 3 files, 52 tests                   |

  Whole branch: 699 raw, 517 effective, which is why #16504 went over the cap.

## Split plan

1. **`feat(server): a moved project folder takes effect on the next turn`**: `ProjectMutation.ts` + `ws.ts` (readable error for a missing folder), `ProviderSessionManager.ts` (replace an idle single-thread session whose cwd changed, keep it if background work is pending or the probe fails), `GitVcsDriver`/`GitVcsDriverCore`/`GitWorkflowService` (`repairWorktrees`), `ProviderTurnStartService.ts` (relink a stranded worktree). Stands alone: `project.update` already accepts `workspaceRoot` (MCP `t3_project_update`), so agents can move a project today and this makes the move work.
2. **`feat(web): change a project's folder after it moves`**: Folder field in `ProjectSettingsPanel.tsx`, key renames in `ProjectSettingsPanel.logic.ts` and `uiStateStore.ts`, user docs section. Needs 1 for the error toast text.
3. **`feat: link a missing project folder error to project settings`**: `ORCHESTRATION_V2_PROJECT_FOLDER_MISSING_FAILURE_CODE` in contracts, the server tags the session-open failure, `TimelineWorkEntryRow.tsx` button, `useOpenProjectSettings.ts` extracted from `useThreadActionMenu.ts`, `Errors.ts` message, docs sentence. Needs 2 so the button lands on a Folder field.

Docs are split across 2 and 3 instead of their own slice: a docs-only PR would document a feature that is not there yet or arrive after it.

- Step 4: pushed to `origin` (`Thaoh/t3code`), fast-forward, no PRs: `feat/relocate-project` `7943cd8..4bec3e6`, `split/relocate-project-1` `4704f9d`, `-2` `41b53e4`, `-3` `9c983d2`. The split branches were built in a temporary sibling worktree `../relocate-upstream-check`, removed afterwards.

## Next

- Nothing left in this backlog. Submitting the slices is your call.

## Open questions

- This file is committed on `feat/relocate-project`. If that branch is ever the head of a PR, drop the file first; the `split/*` branches do not contain it.
- Upstream drifts fast (2451 commits in ~2 weeks). If you submit later, merge `upstream/main` into split-1 first and carry it up the stack; conflicts will be in `ProviderTurnStartService.ts` and `ProjectSettingsPanel.tsx`.
- Two server tests fail here on plain `upstream/main` too (`storageCleanup.test.ts`, `AcpSessionRuntime.processTree.test.ts`). CI was not run: pushes to non-main branches trigger no workflow. Confirm on GitHub CI when a PR exists.
- Playwright's headless shell v1223 was downloaded into `~/.cache/ms-playwright` to run browser tests. Delete it if unwanted.
- Not verified in a real client (no browser or desktop session was authorized). Mobile has no project-settings folder UI; it was out of scope for #16504 and still is.
