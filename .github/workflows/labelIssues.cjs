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
 * @returns {{ labels: Set<string>, assignees: Set<string>, taskName: string, matched: boolean }}
 */
function computeLabels({ title, body, existingLabels, rules, nomatches, tags }) {
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

    const { labels, assignees, taskName, matched } = computeLabels({
        title: issue.title || '',
        body: issue.body || '',
        existingLabels,
        rules: doc.rules || [],
        nomatches: doc.nomatches || [],
        tags: doc.tags || []
    });

    core.info(`Task name: "${taskName || '(none)'}" | rule match: ${matched}`);

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
