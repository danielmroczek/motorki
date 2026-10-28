# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in **danielmroczek/kreski**. Use the `gh` CLI for all operations.

> Supersedes the earlier local-markdown convention (`.scratch/<feature>/`). Existing `.scratch/` files are historical; new work goes to GitHub issues.

## Conventions

- **Create an issue**: `gh issue create --repo danielmroczek/kreski --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --repo danielmroczek/kreski --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --repo danielmroczek/kreski --state all --json number,title,body,labels,comments --jq '[.[] | {number, title, body, state, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters. When gathering the full picture of a feature (specs, history, closed work), query **both open and closed issues** (`--state all`) — closed issues carry context that open-only queries miss.

## When a skill says "publish to the issue tracker"

Create a GitHub issue. If a spec exists only in old `.scratch/` files, link the relevant issue(s) in the new issue body rather than copying the spec over.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --repo danielmroczek/kreski --comments`.

## Historical `.scratch/` content

Before the switch, issues lived as markdown under `.scratch/<feature-slug>/` (spec: `spec.md`, tickets: `issues/NN-<slug>.md`, triage state in a `Status:` line). Those files are readable context only — do not write new issues or ticket state there.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --repo danielmroczek/kreski --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/danielmroczek/kreski/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/danielmroczek/kreski/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --repo danielmroczek/kreski --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --repo danielmroczek/kreski --body "<answer>"`, then `gh issue close <n> --repo danielmroczek/kreski`, then append a context pointer (gist + link) to the map's Decisions-so-far.
