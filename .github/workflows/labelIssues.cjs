// @ts-check
'use strict';

/**
 * Self-contained issue labeler for azure-pipelines-tasks.
 *
 * Replaces the retired `damccorm/tag-ur-it` action. It reads the labeling
 * rules from `issue-rules.yml` and applies `Area:` / `Task:` labels (plus
 * best-effort assignees) to newly opened issues.
 *
 * Why this exists: the old labeler matched the bolded field `**Enter Task
 * Name**` produced by the legacy *markdown* issue template. Issues now use
 * GitHub *YAML issue forms* (.github/ISSUE_TEMPLATE/*.yml), whose `Task name`
 * input renders in the issue body as a `### Task name` heading followed by the
 * value. This module parses that form output instead, so labeling works again.
 *
 * Designed to be invoked from `actions/github-script@v7`:
 *   const run = require('./.github/workflows/labelIssues.cjs');
 *   await run({ github, context, core });
 *
 * `computeLabels` is exported separately so the decision logic can be unit
 * tested without an authenticated Octokit client.
 */

const fs = require('fs');
const path = require('path');

// The issue-form field whose value drives Task:/Area: labeling. This string
// MUST stay in sync with the label: of the "Task name" input in the issue
// form templates under .github/ISSUE_TEMPLATE/*.yml. If that field is renamed
// there, update it here too or labeling will silently stop matching (this is
// exactly the breakage this labeler was written to fix).
const TASK_NAME_FIELD = 'Task name';
function loadYaml() {
    // In CI js-yaml is installed into a temp dir (public registry) and its
    // absolute path is passed via YAML_MODULE, so we never touch the repo's
    // private-feed .npmrc. Fall back to a bare require for local testing.
    const mod = process.env.YAML_MODULE || 'js-yaml';
    return require(mod);
}

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a task-folder name or a user-typed task token to a comparable key:
 * lower-case, drop anything from `@` on (a version like `@5`), keep only
 * alphanumerics, then strip a trailing version segment (`v` + digits). So
 * `AzureCLIV2`, `AzureCLI@2` and `Azure CLI` all normalize to `azurecli`.
 *
 * Kept in sync with the same-named helper in assignOwners.cjs, which resolves
 * owners from CODEOWNERS the same way.
 * @param {string} value
 * @returns {string}
 */
function normalizeTaskKey(value) {
    if (!value) {
        return '';
    }
    let s = String(value).toLowerCase();
    const at = s.indexOf('@');
    if (at !== -1) {
        s = s.slice(0, at);
    }
    s = s.replace(/[^a-z0-9]/g, '');
    s = s.replace(/v\d+$/, '');
    return s;
}

/**
 * Canonical `Task:` label name for a task folder: the folder name with any
 * trailing version segment (`V0`, `V2`, `V10`) removed, so every version of a
 * task shares one label. e.g. `AzureCLIV2` -> `AzureCLI`.
 * @param {string} folder
 * @returns {string}
 */
function canonicalTaskName(folder) {
    return String(folder).replace(/V\d+$/, '');
}

/**
 * Build a lookup from normalized task key -> Set of canonical task names, from
 * the list of `Tasks/<Folder>` directory names in the repo.
 *
 * This is the single source of truth for `Task:` labels: it always reflects
 * the tasks that actually exist in the repo, so labels never drift when tasks
 * are added, renamed, or removed. That drift (hardcoded `Task:` values in
 * issue-rules.yml pointing at renamed/removed tasks, or vague tokens matching
 * several tasks) is exactly the failure mode this replaces.
 * @param {string[]} taskFolders
 * @returns {Map<string, Set<string>>}
 */
function buildTaskIndex(taskFolders) {
    const index = new Map();
    for (const folder of taskFolders || []) {
        if (!folder || /^Common$/i.test(folder)) {
            continue;
        }
        const key = normalizeTaskKey(folder);
        if (!key) {
            continue;
        }
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        index.get(key).add(canonicalTaskName(folder));
    }
    return index;
}

/**
 * Resolve the `Task:` label name for a free-text "Task name" field value by
 * matching it against the real `Tasks/` folders (via `buildTaskIndex`).
 *
 * An exact normalized-key match wins. Otherwise a one-directional prefix match
 * (a folder whose key *extends* the entered value, value length >= 5) is used,
 * but only when it is unambiguous; a vague entry like "Azure" that matches many
 * folders resolves to nothing rather than guessing. Returns the canonical task
 * name (without the `Task: ` prefix), or '' when nothing resolves.
 *
 * The issue form guides users to enter the bare task name (placeholder
 * "E.g. AzurePowerShell", with a separate Task version field), so exact/prefix
 * matching on the whole normalized value is sufficient in practice. A verbose
 * free-text entry that does not normalize to a known task simply yields no
 * Task: label (the issue still gets its Area: label) rather than a wrong guess.
 * @param {string} taskName
 * @param {Map<string, Set<string>>} taskIndex
 * @returns {string}
 */
function resolveTaskName(taskName, taskIndex) {
    const key = normalizeTaskKey(taskName);
    if (!key || !taskIndex) {
        return '';
    }
    if (taskIndex.has(key)) {
        const set = taskIndex.get(key);
        return set.size === 1 ? [...set][0] : '';
    }
    if (key.length >= 5) {
        const hits = new Set();
        for (const [folderKey, set] of taskIndex) {
            if (folderKey.startsWith(key)) {
                for (const canonical of set) {
                    hits.add(canonical);
                }
            }
        }
        if (hits.size === 1) {
            return [...hits][0];
        }
    }
    return '';
}

/**
 * Read the `Tasks/<Folder>` directory names from the checked-out repo. The
 * labeling workflow runs after actions/checkout, so the whole repo (including
 * Tasks/) is on disk. Returns [] if the directory is missing, so labeling
 * degrades gracefully to Area-only rather than failing.
 * @returns {string[]}
 */
function loadTaskFolders() {
    const tasksDir = path.join(process.cwd(), 'Tasks');
    try {
        return fs
            .readdirSync(tasksDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
    } catch (err) {
        return [];
    }
}

/**
 * Extracts the value a user entered for a given GitHub issue-form field.
 * Forms render each input as:
 *
 *   ### <label>
 *
 *   <value...>
 *
 * and use `_No response_` for empty optional inputs.
 *
 * @param {string} body The issue body.
 * @param {string} label The field label (e.g. 'Task name').
 * @returns {string} The trimmed value, or '' when absent / no response.
 */
function extractField(body, label) {
    if (!body) {
        return '';
    }

    const headingRegExp = new RegExp('^###[ \\t]*' + escapeRegExp(label) + '[ \\t]*$', 'im');
    const match = headingRegExp.exec(body);
    if (!match) {
        return '';
    }

    const rest = body.slice(match.index + match[0].length);
    const nextHeading = rest.search(/^###[ \t]/m);
    const value = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();

    if (value === '' || /^_?no response_?$/i.test(value)) {
        return '';
    }

    return value;
}

/**
 * Computes the set of labels and assignees to apply to an issue.
 *
 * @param {object} args
 * @param {string} args.title Issue title.
 * @param {string} args.body Issue body.
 * @param {string[]} args.existingLabels Labels already on the issue (from the
 *   issue form's static `labels:`).
 * @param {any[]} args.rules `rules` from issue-rules.yml.
 * @param {any[]} args.nomatches `nomatches` from issue-rules.yml.
 * @param {any[]} args.tags `tags` from issue-rules.yml.
 * @param {string[]} args.taskFolders `Tasks/<Folder>` directory names, used to
 *   resolve the `Task:` label from the entered task name.
 * @returns {{ labels: Set<string>, assignees: Set<string>, taskName: string, matched: boolean }}
 */
function computeLabels({ title, body, existingLabels, rules, nomatches, tags, taskFolders }) {
    const labels = new Set();
    const assignees = new Set();
    const existing = new Set(existingLabels || []);

    const taskName = extractField(body || '', TASK_NAME_FIELD);
    const taskNameLower = taskName.toLowerCase();

    let matched = false;

    // Primary rules: match the entered task name against each rule's `contains`.
    for (const rule of rules || []) {
        // Legacy `*Type*` rules are obsolete: the issue-form templates now apply
        // the type label (bug / enhancement / etc.) statically on creation.
        if (/type/i.test(rule.valueFor || '')) {
            continue;
        }
        if (!rule.contains || !taskNameLower) {
            continue;
        }
        if (taskNameLower.includes(String(rule.contains).toLowerCase())) {
            matched = true;
            (rule.addLabels || []).forEach(label => labels.add(label));
            (rule.assign || []).forEach(user => assignees.add(user));
        }
    }

    // Resolve the `Task:` label from the actual Tasks/ folders in the repo,
    // rather than from hardcoded `Task:` values in issue-rules.yml (which drift
    // when tasks are renamed/removed). This is independent of the Area rules
    // above and does not affect `matched`, so the nomatches fallback below is
    // unchanged.
    const resolvedTask = resolveTaskName(taskName, buildTaskIndex(taskFolders));
    if (resolvedTask) {
        labels.add('Task: ' + resolvedTask);
    }

    // Fallback: if nothing matched, scan the whole issue for team hints.
    if (!matched) {
        const haystack = ((title || '') + '\n' + (body || '')).toLowerCase();
        for (const rule of nomatches || []) {
            if (rule.contains && haystack.includes(String(rule.contains).toLowerCase())) {
                (rule.addLabels || []).forEach(label => labels.add(label));
            }
        }
    }

    // Post-pass: enforce required tags (e.g. add `triage` / `route`).
    const current = new Set([...existing, ...labels]);
    for (const tag of tags || []) {
        if (Array.isArray(tag.noneIn)) {
            if (!tag.noneIn.some(label => current.has(label))) {
                (tag.addLabels || []).forEach(label => {
                    labels.add(label);
                    current.add(label);
                });
            }
        }
        if (tag.noneMatch) {
            let noneMatchRegExp = null;
            try {
                noneMatchRegExp = new RegExp(tag.noneMatch);
            } catch (err) {
                noneMatchRegExp = null;
            }
            if (noneMatchRegExp && ![...current].some(label => noneMatchRegExp.test(label))) {
                (tag.addLabels || []).forEach(label => {
                    labels.add(label);
                    current.add(label);
                });
            }
        }
    }

    // Never re-request labels the issue already carries.
    for (const label of existing) {
        labels.delete(label);
    }

    return { labels, assignees, taskName, matched };
}

/**
 * Entry point for actions/github-script@v7.
 * @param {{ github: any, context: any, core: any }} args
 */
async function run({ github, context, core }) {
    const yaml = loadYaml();
    const rulesPath = path.join(process.cwd(), 'issue-rules.yml');
    const doc = yaml.load(fs.readFileSync(rulesPath, 'utf8')) || {};

    const issue = context.payload.issue;
    if (!issue) {
        core.warning('No issue in payload; nothing to label.');
        return;
    }

    const existingLabels = (issue.labels || []).map(label => (typeof label === 'string' ? label : label.name));

    const taskFolders = loadTaskFolders();
    if (taskFolders.length === 0) {
        // Fail safe to Area-only labeling, but make the misconfiguration visible:
        // this normally means the repo wasn't checked out or cwd isn't the repo root.
        core.warning(`No Tasks/ folders found under "${process.cwd()}"; Task: labels will not be applied.`);
    }

    const { labels, assignees, taskName, matched } = computeLabels({
        title: issue.title || '',
        body: issue.body || '',
        existingLabels,
        rules: doc.rules || [],
        nomatches: doc.nomatches || [],
        tags: doc.tags || [],
        taskFolders
    });

    core.info(`Task name: "${taskName || '(none)'}" | rule match: ${matched} | task folders: ${taskFolders.length}`);

    const { owner, repo } = context.repo;
    const issue_number = issue.number;

    if (labels.size > 0) {
        await github.rest.issues.addLabels({ owner, repo, issue_number, labels: [...labels] });
        core.info('Added labels: ' + [...labels].join(', '));
    } else {
        core.info('No new labels to add.');
    }

    if (assignees.size > 0) {
        // Best-effort: the API silently ignores users without repo access, but
        // guard anyway so labeling never fails because of assignment.
        try {
            await github.rest.issues.addAssignees({ owner, repo, issue_number, assignees: [...assignees] });
            core.info('Requested assignees: ' + [...assignees].join(', '));
        } catch (err) {
            core.warning('Could not add assignees: ' + err.message);
        }
    }
}

module.exports = run;
module.exports.computeLabels = computeLabels;
module.exports.extractField = extractField;
module.exports.normalizeTaskKey = normalizeTaskKey;
module.exports.canonicalTaskName = canonicalTaskName;
module.exports.buildTaskIndex = buildTaskIndex;
module.exports.resolveTaskName = resolveTaskName;
