---
description: "Use when editing, reviewing, or modifying files inside a deprecated Azure Pipelines task. Covers code review warnings, deprecation policy, and guidance to avoid investing in unmaintained tasks."
applyTo: "Tasks/**"
---
# Deprecated Tasks Policy

Before modifying any task, check whether it is deprecated by looking for `"deprecated": true` in the task's `task.json`. If the task is deprecated:

## Hard Rules

- **Do not add features or enhancements** to deprecated tasks. They are unmaintained and scheduled for removal.
- **Do not refactor or modernize** deprecated task code (no dependency upgrades, no style fixes, no TypeScript migrations).
- **Security-only fixes are acceptable** — if a CVE or critical vulnerability affects a deprecated task that has not yet been removed, a minimal targeted patch is permitted.
- **Flag in code review**: If a PR touches files inside a deprecated task directory, flag it. The author should confirm the change is either a security fix or should be redirected to the replacement task.

## How to Identify Deprecated Tasks

1. Open `Tasks/<TaskName>/task.json`
2. Look for `"deprecated": true` at the top level of the JSON
3. Cross-reference with [DEPRECATION.md](../../DEPRECATION.md) for deprecation dates and migration PRs

## What to Do Instead

- Find the replacement task mentioned in the deprecated task's `description` field or `helpMarkDown` in `task.json`
- Apply your change to the **latest non-deprecated version** of the task (e.g., use `DockerV2` instead of `DockerV0`)
- If no replacement exists, discuss with the team before proceeding
