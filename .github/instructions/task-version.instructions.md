---
applyTo: "Tasks/**/task.json, Tasks/**/task.loc.json"
description: "Use when editing task.json or task.loc.json version fields in Azure Pipelines tasks. Covers sprint-based version bumping rules."
---
# Task Version Bumping

When modifying a task's `version` in `task.json` or `task.loc.json`:

1. Fetch the current sprint from https://whatsprintis.it/?json
2. If the sprint week is past Tuesday of week 3 (i.e., week > 3, or week == 3 and today is after Tuesday), target `Minor = sprint + 1`. Otherwise target `Minor = sprint`.
3. If the task's current `Minor` already equals the target, increment `Patch` by 1.
4. If the task's current `Minor` differs from the target, set `Minor` to the target and reset `Patch` to 0.
5. For major behavioural changes (no backward compatibility), increment `Major` instead.
6. **Always update both `task.json` and `task.loc.json`** with the same version.
