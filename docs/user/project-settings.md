# Project settings

Open **Settings → Projects** and select a project to change its preferences.

## Project icons

Choose an icon, emoji, or image from the project to make it easier to recognize. The choice applies
to every checkout in the project group and appears on connected clients. Choose **Automatic** to
let T3 Code detect an icon again.

## Change a project directory

If a project's folder was moved or deleted, threads in that project fail until the checkout path
is updated.

1. Open the project from **Settings → Projects**, or choose **Open project settings** on the error
   in the thread.
2. Under **Checkout**, select **Change folder**.
3. Choose the folder (desktop) or type the new path (browser) and press Enter.

The updated path applies to that checkout. Existing threads keep working against the new folder.

## Keep the default branch current

Enable **Automatically pull** to keep the default-branch checkout up to date with its configured
upstream.

T3 Code only pulls when it can fast-forward and the checkout has no changed files, untracked files,
or local commits. It skips checkouts on another branch or without an upstream. If a checkout has
local work, resolve it yourself before automatic pulls can resume.
