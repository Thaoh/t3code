# feat/relocate-project: upstream sync and split plan

Fork `Thaoh/t3code`, branch `feat/relocate-project` (head of closed pingdotgg/t3code#16504).

## Done

- Step 0: on `feat/relocate-project` at `7943cd8`. Added `upstream` (pingdotgg/t3code), fetched `upstream/main` at `90c455f`. Branch was 22 ahead, 2451 behind.
- Push check: `.forgejo/workflows/` absent. `.github/workflows/` runs on pushes to `main`, tags, PRs, `workflow_run`, schedule or dispatch only. A push to `feat/relocate-project` or `split/*` triggers nothing.
- Step 1: this file.

## Next

- Step 2: merge `upstream/main`, resolve conflicts (upstream shape wins), typecheck, lint, test.
- Step 3: split plan and `split/relocate-project-N` branches.
- Step 4: push `feat/relocate-project` and `split/*` to origin.

## Open questions

(none yet)
