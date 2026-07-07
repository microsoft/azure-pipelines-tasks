// @ts-check
'use strict';

/**
 * Auto-assign issue owners based on the affected task, using the repo's
 * .github/CODEOWNERS as the single source of truth for ownership.
 *
 * Invoked from actions/github-script@v7 (see assignOwners.yml):
 *   const { run } = require('./.github/workflows/assignOwners.cjs');
 *   await run({ github, context, core });
 *
 * How the affected task is determined (both signals are used and unioned):
 *   1. The "Task name" field of the issue form (renders as `### Task name`).
 *   2. Any `Task: <name>` labels on the issue.
 *
 * Each task token is normalized (lower-cased, spaces/`@version` stripped,
 * trailing version suffix like `V2`/`V10` removed) and matched against the
 * normalized `Tasks/<Folder>/` entries in CODEOWNERS. Only *individual* code
 * owners are used as assignees; GitHub teams (`@org/team`) are ignored because
 * issues can only be assigned to users.
 *
 * When a task resolves to several owners, a single assignee is chosen by
 * ASSIGNEE_PRIORITY (tarunramsinghani, then manolerazvan), falling back to the
 * first resolved owner.
 *
 * The workflow assigns owners only when the issue currently has no assignees,
 * so it never overrides a human decision and never double-assigns.
 *
 * Must be CommonJS (`.cjs`): `.github/workflows/package.json` declares
 * `{"type":"module"}` and actions/github-script requires CommonJS.
 */

const fs = require('fs');
const path = require('path');

/**
 * When a task resolves to several code owners, we assign a single person,
 * chosen by this descending priority. If none of these are among the resolved
 * owners, the first resolved owner is used as a fallback.
 * @type {string[]}
 */
const ASSIGNEE_PRIORITY = ['tarunramsinghani', 'manolerazvan'];

/**
 * Normalize a task-folder name or a user-supplied task token to a comparable
 * key: lower-case, drop anything from `@` on (a version like `@5`), keep only
 * alphanumerics, then strip a trailing version segment (`v` + digits).
 * @param {string} value
 * @returns {string}
 */
function normalizeTaskKey(value) {
  if (!value) return '';
  let s = String(value).toLowerCase();
  const at = s.indexOf('@');
  if (at !== -1) s = s.slice(0, at); // drop "@5" style version
  s = s.replace(/[^a-z0-9]/g, ''); // drop spaces/punctuation
  s = s.replace(/v\d+$/, ''); // drop trailing version, e.g. v2 / v10
  return s;
}

/**
 * @typedef {{ folder: string, key: string, owners: string[] }} OwnerEntry
 */

/**
 * Parse CODEOWNERS into task-folder ownership entries.
 * Keeps only top-level `Tasks/<Folder>` rules (excludes `Tasks/Common/...`)
 * and keeps only individual owners (drops `@org/team` entries and the global
 * `*` catch-all).
 * @param {string} text
 * @returns {OwnerEntry[]}
 */
function parseCodeowners(text) {
  /** @type {OwnerEntry[]} */
  const entries = [];
  const lines = String(text).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const tokens = line.split(/\s+/);
    const pattern = tokens[0];
    if (!/^Tasks\//i.test(pattern)) continue;

    // Folder = first path segment after "Tasks/".
    const rest = pattern.replace(/^Tasks\//i, '').replace(/\/+$/, '');
    const folder = rest.split('/')[0];
    if (!folder || /^Common$/i.test(folder)) continue;
    // Skip nested Common paths (Tasks/Common/...) — not user-facing tasks.
    if (/^Common$/i.test(rest.split('/')[0])) continue;

    const owners = [];
    for (const tok of tokens.slice(1)) {
      if (tok.startsWith('#')) break; // trailing comment
      if (!tok.startsWith('@')) continue;
      const handle = tok.slice(1);
      if (handle.includes('/')) continue; // team (e.g. org/team) — not assignable
      if (handle) owners.push(handle);
    }
    if (owners.length === 0) continue;

    entries.push({ folder, key: normalizeTaskKey(folder), owners });
  }
  return entries;
}

/**
 * Extract the value of the issue-form "Task name" field from an issue body.
 * The field renders as a `### Task name` heading followed by the value.
 * Returns '' when absent or filled with `_No response_`.
 * @param {string} body
 * @returns {string}
 */
function extractTaskName(body) {
  if (!body) return '';
  const lines = String(body).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s*task name\s*$/i.test(lines[i].trim())) {
      // Collect the first non-empty line after the heading.
      for (let j = i + 1; j < lines.length; j++) {
        const v = lines[j].trim();
        if (!v) continue;
        if (/^#{1,6}\s/.test(v)) break; // next section
        if (/^_no response_$/i.test(v)) return '';
        return v;
      }
      return '';
    }
  }
  return '';
}

/**
 * Given task tokens and CODEOWNERS entries, compute the deduped list of
 * individual owners to assign. Exact (normalized) match is preferred; if a
 * token has no exact match, a conservative fallback matches folders whose key
 * starts with the token (token length >= 5) to tolerate minor name variants.
 * @param {string[]} taskTokens
 * @param {OwnerEntry[]} entries
 * @param {{ info?: (m: string) => void }} [log]
 * @returns {string[]}
 */
function computeAssignees(taskTokens, entries, log) {
  const assignees = new Set();
  for (const token of taskTokens) {
    const key = normalizeTaskKey(token);
    if (!key) continue;

    let matched = entries.filter((e) => e.key === key);
    let mode = 'exact';
    if (matched.length === 0 && key.length >= 5) {
      // One-directional prefix match only: tolerate a folder whose normalized
      // name *extends* the entered task (e.g. "AzureFunctionApp" ->
      // "AzureFunctionAppContainer"). We deliberately do NOT also match the
      // reverse direction (folder key is a prefix of the entered value): the
      // "Task name" field is free text typed by hand, so a vague entry like
      // "Azure" would pull in dozens of unrelated folders across many owners
      // and then silently collapse to a single priority person. If the prefix
      // is ambiguous (matches more than one folder) we skip rather than guess.
      matched = entries.filter((e) => e.key.startsWith(key));
      mode = 'fuzzy';
      if (matched.length > 1) {
        if (log && log.info) {
          log.info(
            `Ambiguous fuzzy match for task "${token}" (key="${key}"): ` +
            `${matched.map((m) => m.folder).join(', ')}; skipping to avoid guessing an owner.`
          );
        }
        continue;
      }
    }
    if (matched.length === 0) {
      if (log && log.info) log.info(`No CODEOWNERS match for task "${token}" (key="${key}").`);
      continue;
    }
    if (log && log.info) {
      log.info(`Task "${token}" (key="${key}") matched ${matched.map((m) => m.folder).join(', ')} [${mode}].`);
    }
    for (const e of matched) for (const o of e.owners) assignees.add(o);
  }
  return [...assignees];
}

/**
 * Reduce a resolved owner list to the single assignee to use, honoring
 * ASSIGNEE_PRIORITY (case-insensitive). Falls back to the first resolved owner
 * when no priority owner is present. Returns [] for an empty input.
 * @param {string[]} owners
 * @returns {string[]} zero or one login.
 */
function selectAssignee(owners) {
  if (!owners || owners.length === 0) return [];
  for (const preferred of ASSIGNEE_PRIORITY) {
    const hit = owners.find((o) => o.toLowerCase() === preferred.toLowerCase());
    if (hit) return [hit];
  }
  return [owners[0]];
}

/**
 * Entry point invoked by actions/github-script.
 * @param {{ github: any, context: any, core: any }} ctx
 */
async function run({ github, context, core }) {
  const issue = context.payload && context.payload.issue;
  if (!issue) {
    core.info('No issue in payload; nothing to do.');
    return;
  }
  if (issue.state && issue.state !== 'open') {
    core.info(`Issue #${issue.number} is ${issue.state}; skipping.`);
    return;
  }
  if (Array.isArray(issue.assignees) && issue.assignees.length > 0) {
    core.info(`Issue #${issue.number} already has assignees; skipping.`);
    return;
  }

  const codeownersPath = path.join(process.cwd(), '.github', 'CODEOWNERS');
  const entries = parseCodeowners(fs.readFileSync(codeownersPath, 'utf8'));

  // Prefer the `Task:` label signal over the free-text "Task name" field.
  // The labeler applies `Task:` labels from a controlled mapping, whereas the
  // field is hand-typed and can be vague. Resolve labels first and only fall
  // back to the field when no label resolves an owner, so a vague field value
  // (e.g. "Azure") can't override or dilute a precise label (e.g. a
  // "Task: CacheV2" label that resolves to a specific owner). Multiple
  // `Task:` labels are still unioned among themselves.
  const labelTokens = [];
  const labelNames = (issue.labels || []).map((l) =>
    typeof l === 'string' ? l : l && l.name
  );
  for (const name of labelNames) {
    if (name && /^Task:\s*/i.test(name)) labelTokens.push(name.replace(/^Task:\s*/i, ''));
  }
  const fieldToken = extractTaskName(issue.body || '');

  if (labelTokens.length === 0 && !fieldToken) {
    core.info(`Issue #${issue.number}: no task name field or Task: label found; skipping.`);
    return;
  }

  let resolved = computeAssignees(labelTokens, entries, core);
  let source = 'Task: label(s)';
  if (resolved.length === 0 && fieldToken) {
    resolved = computeAssignees([fieldToken], entries, core);
    source = 'Task name field';
  }
  if (resolved.length === 0) {
    const attempted = [...labelTokens];
    if (fieldToken) attempted.push(fieldToken);
    core.info(`Issue #${issue.number}: no individual code owner resolved for tasks [${attempted.join(', ')}].`);
    return;
  }

  const assignees = selectAssignee(resolved);
  if (resolved.length > 1) {
    core.info(`Resolved owners [${resolved.join(', ')}]; selected ${assignees[0]} by priority.`);
  }

  // Re-read assignees from LIVE state right before assigning. The event
  // payload snapshot can be stale: the labeler adds several labels per issue
  // and GitHub fires one `labeled` event per label, so multiple runs of this
  // workflow can fire for the same issue, each carrying the assignee list as
  // it was when its event was created. The workflow-level concurrency group
  // (see assignOwners.yml) serializes runs per issue; this live check makes
  // the "no assignees yet" guard authoritative, so a run that starts after an
  // earlier run has already assigned will observe it and skip. Without it,
  // `addAssignees` (which adds rather than replaces) could double-assign.
  try {
    const live = await github.rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.number,
    });
    const liveAssignees =
      live && live.data && Array.isArray(live.data.assignees) ? live.data.assignees : [];
    if (liveAssignees.length > 0) {
      core.info(`Issue #${issue.number} was assigned by another run; skipping.`);
      return;
    }
  } catch (err) {
    core.warning(
      `Could not re-check live assignees for #${issue.number}; proceeding. ${err && err.message ? err.message : err}`
    );
  }

  core.info(`Assigning #${issue.number} to: ${assignees.join(', ')} (source: ${source}).`);
  try {
    await github.rest.issues.addAssignees({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.number,
      assignees,
    });
  } catch (err) {
    core.warning(
      `Failed to assign [${assignees.join(', ')}] to #${issue.number}: ${err && err.message ? err.message : err}`
    );
  }
}

module.exports = { run, computeAssignees, selectAssignee, parseCodeowners, extractTaskName, normalizeTaskKey };
