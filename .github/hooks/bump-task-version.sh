#!/usr/bin/env bash
set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract file path from the tool input (covers various tool parameter names)
FILE_PATH=$(echo "$INPUT" | jq -r '
  .toolInput.filePath //
  .toolInput.file_path //
  .toolInput.path //
  empty' 2>/dev/null || true)

# Only act when editing files under a Tasks/ directory
if [[ ! "$FILE_PATH" =~ ^Tasks/ ]]; then
  exit 0
fi

# Extract task name from path for the system message
TASK_NAME=$(echo "$FILE_PATH" | sed -n 's|^Tasks/\([^/]*\)/.*|\1|p')
if [[ -z "$TASK_NAME" ]]; then
  exit 0
fi

# Fetch current sprint info
SPRINT_JSON=$(curl -sf --max-time 5 "https://whatsprintis.it/?json") || exit 0
SPRINT=$(echo "$SPRINT_JSON" | jq -r '.sprint')
WEEK=$(echo "$SPRINT_JSON" | jq -r '.week')

if [[ -z "$SPRINT" || "$SPRINT" == "null" ]]; then
  exit 0
fi

# Determine target minor version based on sprint week and day-of-week
# Cutoff: Tuesday of the 3rd sprint week. After that, target next sprint.
DAY_OF_WEEK=$(date +%u) # 1=Monday … 7=Sunday
if [[ "$WEEK" -gt 3 ]] || { [[ "$WEEK" -eq 3 ]] && [[ "$DAY_OF_WEEK" -gt 2 ]]; }; then
  TARGET_MINOR=$((SPRINT + 1))
  REASON="past the Tuesday week-3 cutoff of sprint ${SPRINT}"
else
  TARGET_MINOR=$SPRINT
  REASON="within sprint ${SPRINT} (week ${WEEK})"
fi

cat <<EOF
{
  "systemMessage": "TASK VERSION BUMPING (${TASK_NAME}) — Sprint data (${REASON}): target Minor=${TARGET_MINOR}. Rules: if the task's current Minor already equals ${TARGET_MINOR}, increment Patch by 1. Otherwise set Minor=${TARGET_MINOR} and Patch=0. Always update BOTH task.json AND task.loc.json with the same version. Do NOT increment Major — major version changes require creating a new task directory (e.g. TaskV3 -> TaskV4)."
}
EOF
