---
applyTo: "Tasks/**"
description: "Use when editing any file in a pipeline task directory. Covers sprint-based version bumping rules and major version guidance."
---
# Task Version Bumping

When modifying any file under a task directory (`Tasks/<TaskName>/`), the task version in `task.json` and `task.loc.json` must be bumped.

## Minor / Patch bumps

1. Fetch the current sprint from https://whatsprintis.it/?json
2. If the sprint week is past Tuesday of week 3 (i.e., week > 3, or week == 3 and today is after Tuesday), target `Minor = sprint + 1`. Otherwise target `Minor = sprint`.
3. If the task's current `Minor` already equals the target, increment `Patch` by 1.
4. If the task's current `Minor` differs from the target, set `Minor` to the target and reset `Patch` to 0.
5. **Always update both `task.json` and `task.loc.json`** with the same version.

## Major version changes

Do **not** increment the `Major` field in an existing task. Instead, create a new task directory with the next major version suffix (e.g., `MavenV3` -> `MavenV4`). The new directory is a full copy of the task with its own `task.json`, `task.loc.json`, and source files.
