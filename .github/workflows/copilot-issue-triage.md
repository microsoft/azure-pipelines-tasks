---
emoji: "🤖"
name: Copilot Issue Triage (POC)
description: >-
  Scheduled agentic workflow that finds well-scoped, human-approved issues and
  assigns them to the GitHub Copilot coding agent for a fix PR. Adapted from
  github/gh-aw issue-monster for microsoft/azure-pipelines-tasks.

# ---------------------------------------------------------------------------
# POC NOTES (safe to delete before productionizing)
#
# This is a gh-aw *source* workflow. Compile it with:
#     gh aw compile copilot-issue-triage
# which generates copilot-issue-triage.lock.yml (a normal Actions workflow).
# Only the .lock.yml runs in CI; edit this .md and recompile after frontmatter
# changes.
#
# SAFETY MODEL (why this is safe to run on a large public repo):
#   * The agent job is READ-ONLY. Every write goes through `safe-outputs:`,
#     which the compiler wires into separate, tightly-scoped jobs.
#   * Assignment is gated on an opt-in label `copilot-candidate` (the analog of
#     issue-monster's `cookie` label). Nothing is auto-assigned until a
#     maintainer approves an issue by adding that label.
#   * `assign-to-agent` is restricted to the `copilot` agent, capped at 2/run,
#     and `ignore-if-error` so a temporarily-unavailable agent never fails CI.
#   * A pre-activation search (github-script) does the heavy filtering/scoring
#     deterministically, so the model only reasons over a small candidate set.
#
# FORK FOR YOUR TEAM (this workflow is generic; RM is the shipped example):
#   Each area team runs its OWN copy of this workflow. To create one:
#     1. Copy this file to `.github/workflows/copilot-issue-triage-<team>.md`.
#     2. Edit the `CONFIG = { … }` block in the pre-activation script (the ONLY
#        place with team-specific filter values):
#          - `team`               display name for logs
#          - `gateLabel`          a DISTINCT opt-in label per team so teams do
#                                 not pick each other's issues (e.g.
#                                 `copilot-candidate-artifacts`)
#          - `areaLabels`         the `Area: …` labels your team owns
#          - `codeownersHandles`  CODEOWNERS handles whose `Tasks/*` you own
#                                 (use `[]` to scope by area labels only)
#          - `excludeLabels` / `priorityLabels`  optional per-team tuning
#     3. Edit the FRONTMATTER identity to match: `name`, `description`,
#        `schedule`, `safe-outputs.messages`, and the per-run caps
#        `safe-outputs.assign-to-agent.max` / `add-comment.max`.
#     4. `gh aw compile copilot-issue-triage-<team>` and commit both files.
#   The RM team's filter is preserved by the CONFIG values shipped in THIS file.
# ---------------------------------------------------------------------------

on:
  workflow_dispatch:
  # Fuzzy daily schedule — gh-aw picks a stable per-repo time to avoid load
  # spikes. Keep infrequent for a POC; issue-monster runs every 30m.
  schedule: daily

  # Deterministic pre-activation search + prioritization. Runs before the agent
  # and publishes the candidate list as job outputs the agent consumes.
  steps:
    - name: Search for candidate issues
      id: search
      uses: actions/github-script@v7
      with:
        script: |
          // =================================================================
          // TEAM CONFIG — edit ONLY this block to make your team's version.
          // Everything after the "GENERIC ENGINE" marker is team-neutral;
          // copy it as-is. Team identity that lives in FRONTMATTER — `name`,
          // `description`, `schedule`, `safe-outputs.messages`, and the per-run
          // cap `safe-outputs.assign-to-agent.max` / `add-comment.max` — must
          // also be set per team (see the "FORK FOR YOUR TEAM" POC note above).
          //
          // An issue is IN SCOPE when ANY of these hold:
          //   (a) it carries one of `areaLabels`, OR
          //   (b) its Task maps to a Tasks/* folder owned in CODEOWNERS by ANY
          //       handle in `codeownersHandles`.
          // Set `codeownersHandles: []` to scope purely by area labels.
          // =================================================================
          const CONFIG = {
            team: 'RM',                                  // shown in logs only
            gateLabel: 'copilot-candidate',              // opt-in approval label (use a DISTINCT one per team)
            areaLabels: ['Area: Release', 'Area:RM'],    // in-scope Area labels
            codeownersHandles: ['manolerazvan'],         // CODEOWNERS owners whose Tasks/* are in scope
            excludeLabels: [                             // disqualifying labels (triage/route/aa-triaged intentionally NOT here)
              'question', 'need repro', 'need-repro', 'investigate',
              'stale', 'backlog', 'external', 'duplicate', 'invalid', 'wontfix',
              'awaiting deployment', 'blocked', 'on-hold', 'DTS', 'no-bot',
            ],
            priorityLabels: [                            // actionable labels that also drive scoring
              'good first issue', 'good-first-issue', 'help wanted',
              'bug', 'regression', 'enhancement', 'p1',
            ],
          };

          // =================================================================
          // GENERIC ENGINE — no team-specific values below this line.
          // =================================================================
          const { owner, repo } = context.repo;
          const MAX_ISSUES_WITH_BODY_CONTEXT = 6;
          const BODY_SNIPPET_MAX_LENGTH = 600;

          const GATE_LABEL = CONFIG.gateLabel;
          const excludeLabels = CONFIG.excludeLabels.map(l => l.toLowerCase());
          const priorityLabels = CONFIG.priorityLabels.map(l => l.toLowerCase());
          const scopeAreaLabels = CONFIG.areaLabels.map(l => l.toLowerCase());
          const scopeHandles = CONFIG.codeownersHandles.map(h => h.replace(/^@/, '').toLowerCase());
          // Normalize a task identifier: lowercase, drop a trailing "@<version>",
          // strip all non-alphanumerics.
          const normalizeTask = s =>
            (s || '').toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '');
          // Extract the "Task name" value from an issue-form body (rendered as a
          // "### Task name" heading followed by the value on the next line).
          const extractTaskName = body => {
            if (!body) return '';
            const m = body.match(/#{1,6}[^\S\r\n]*Task name[^\S\r\n]*\r?\n+[^\S\r\n]*([^\r\n#][^\r\n]*)/i);
            return m ? m[1].trim() : '';
          };

          try {
            // Build the set of task base-names owned by CONFIG.codeownersHandles
            // by reading .github/CODEOWNERS (read-only). Versioned folders
            // (…V0, …V1, …) collapse to a single base name. Skipped entirely
            // when no handles are configured (area-only scoping).
            const ownedTasks = new Set();
            if (scopeHandles.length) {
              try {
                const co = await github.rest.repos.getContent({ owner, repo, path: '.github/CODEOWNERS' });
                const text = Buffer.from(co.data.content, 'base64').toString('utf8');
                const handleRe = new RegExp(`(^|\\s)@(${scopeHandles.join('|')})(\\s|$)`, 'i');
                for (const raw of text.split(/\r?\n/)) {
                  const line = raw.trim();
                  if (!line || line.startsWith('#')) continue;
                  if (!handleRe.test(line)) continue;
                  const m = line.split(/\s+/)[0].match(/(?:^|\/)Tasks\/([^/]+)\//i);
                  if (!m || /^common$/i.test(m[1])) continue;
                  ownedTasks.add(normalizeTask(m[1].replace(/V\d+$/i, '')));
                }
                core.info(`[${CONFIG.team}] owners {${scopeHandles.join(', ')}} own ${ownedTasks.size} task base-name(s) per CODEOWNERS`);
              } catch (e) {
                core.warning(`Could not read CODEOWNERS (owned-task filter disabled): ${e.message}`);
              }
            }

            // Base search: open, gated issues, not already excluded.
            const query =
              `is:issue is:open repo:${owner}/${repo} label:"${GATE_LABEL}" ` +
              excludeLabels.map(l => `-label:"${l}"`).join(' ');
            core.info(`Searching: ${query}`);

            const response = await github.rest.search.issuesAndPullRequests({
              q: query, per_page: 100, sort: 'created', order: 'desc',
            });
            core.info(`Found ${response.data.total_count} issues matching basic criteria`);

            // Enrich each candidate with linked-PR info (skip ones already
            // being worked on by Copilot) via GraphQL.
            const enriched = (await Promise.all(response.data.items.map(async (issue) => {
              let full;
              try {
                full = await github.rest.issues.get({ owner, repo, issue_number: issue.number });
              } catch (e) {
                core.warning(`Skipping #${issue.number}: ${ (e.message || e).slice(0,120) }`);
                return null;
              }
              let linkedPRs = [];
              try {
                const q = `query($owner:String!,$repo:String!,$number:Int!){
                  repository(owner:$owner,name:$repo){ issue(number:$number){
                    timelineItems(first:100, itemTypes:[CROSS_REFERENCED_EVENT]){ nodes{
                      ... on CrossReferencedEvent { source { __typename
                        ... on PullRequest { number state isDraft author { login } } } } } } } } }`;
                const r = await github.graphql(q, { owner, repo, number: issue.number });
                linkedPRs = (r?.repository?.issue?.timelineItems?.nodes || [])
                  .filter(n => n?.source?.__typename === 'PullRequest')
                  .map(n => ({ number: n.source.number, state: n.source.state, author: n.source.author?.login }));
              } catch (e) {
                core.warning(`Could not read linked PRs for #${issue.number}: ${e.message}`);
              }
              return { ...full.data, linkedPRs };
            }))).filter(Boolean);

            const scored = enriched.filter(issue => {
              if (issue.assignees && issue.assignees.length > 0) {
                core.info(`Skip #${issue.number}: already assigned`); return false;
              }
              const labels = issue.labels.map(l => (l.name || l).toLowerCase());
              // Ownership scope (ANY of): an in-scope Area label, or a Task
              // owned by a configured CODEOWNERS handle. Replaces the generic
              // "must be triaged to an Area" gate.
              const inScopeArea = labels.some(l => scopeAreaLabels.includes(l));
              const taskLabelMatch = labels
                .filter(l => l.startsWith('task:'))
                .map(l => normalizeTask(l.slice('task:'.length)))
                .some(t => t && ownedTasks.has(t));
              const bodyTask = normalizeTask(extractTaskName(issue.body));
              const taskBodyMatch = !!bodyTask && ownedTasks.has(bodyTask);
              if (!(inScopeArea || taskLabelMatch || taskBodyMatch)) {
                core.info(`Skip #${issue.number}: outside [${CONFIG.team}] scope (need an areaLabel or an owned Task)`);
                return false;
              }
              // Must have at least one actionable priority label.
              if (!labels.some(l => priorityLabels.includes(l))) {
                core.info(`Skip #${issue.number}: no actionable label`); return false;
              }
              // Skip if closed/merged PR exists (treat as done) or an open Copilot PR exists.
              const closed = (issue.linkedPRs||[]).filter(p => p.state === 'CLOSED' || p.state === 'MERGED');
              if (closed.length) { core.info(`Skip #${issue.number}: has closed/merged PR`); return false; }
              const copilotPR = (issue.linkedPRs||[]).filter(p =>
                p.state === 'OPEN' && (p.author === 'copilot-swe-agent' || (p.author||'').includes('copilot')));
              if (copilotPR.length) { core.info(`Skip #${issue.number}: open Copilot PR`); return false; }
              return true;
            }).map(issue => {
              const labels = issue.labels.map(l => (l.name || l).toLowerCase());
              let score = 0;
              if (labels.includes('good first issue') || labels.includes('good-first-issue')) score += 50;
              if (labels.includes('help wanted')) score += 40;
              if (labels.includes('p1')) score += 45;
              if (labels.includes('regression')) score += 40;
              if (labels.includes('bug')) score += 35;
              if (labels.includes('enhancement')) score += 25;
              const ageDays = Math.floor((Date.now() - new Date(issue.created_at)) / 86400000);
              score += Math.min(ageDays / 10, 20);
              return {
                number: issue.number, title: issue.title,
                labels: issue.labels.map(l => l.name || l), body: issue.body,
                created_at: issue.created_at, score,
              };
            }).sort((a, b) => b.score - a.score);

            const issueList = scored.map(i =>
              `#${i.number}: ${i.title} [${i.labels.join(', ')}] (score: ${i.score.toFixed(1)})`).join('\n');
            const issueContext = scored.slice(0, MAX_ISSUES_WITH_BODY_CONTEXT).map(i => {
              const body = (i.body || '').replace(/\s+/g, ' ').trim();
              const snip = body.length > BODY_SNIPPET_MAX_LENGTH ? `${body.slice(0, BODY_SNIPPET_MAX_LENGTH)}…` : body;
              return `#${i.number} | score=${i.score.toFixed(1)} | labels=${i.labels.join(', ')}\nTitle: ${i.title}\nBody: ${snip || '(no body)'}`;
            }).join('\n\n---\n\n');

            core.info(`Total candidates after filtering: ${scored.length}`);
            core.setOutput('issue_count', scored.length);
            core.setOutput('issue_numbers', scored.map(i => i.number).join(','));
            core.setOutput('issue_list', issueList);
            core.setOutput('issue_context', issueContext);
            core.setOutput('has_issues', scored.length > 0 ? 'true' : 'false');
          } catch (error) {
            core.error(`Error searching for issues: ${error.message}`);
            core.setOutput('issue_count', 0);
            core.setOutput('issue_numbers', '');
            core.setOutput('issue_list', '');
            core.setOutput('issue_context', '');
            core.setOutput('has_issues', 'false');
          }

# Only run the agent if the pre-activation search found candidates.
if: needs.pre_activation.outputs.has_issues == 'true'

permissions:
  contents: read
  issues: read
  pull-requests: read
  # Lets the Copilot engine use the Actions token for inference instead of a
  # COPILOT_GITHUB_TOKEN PAT (requires org-level centralized Copilot billing).
  copilot-requests: write

strict: true

network:
  allowed: [defaults]

engine: copilot

timeout-minutes: 20

tools:
  github:
    mode: gh-proxy
    toolsets: [issues]

jobs:
  pre-activation:
    outputs:
      issue_count: ${{ steps.search.outputs.issue_count }}
      issue_numbers: ${{ steps.search.outputs.issue_numbers }}
      issue_list: ${{ steps.search.outputs.issue_list }}
      issue_context: ${{ steps.search.outputs.issue_context }}
      has_issues: ${{ steps.search.outputs.has_issues }}

safe-outputs:
  assign-to-agent:
    max: 2
    target: "*"            # requires explicit issue_number in agent output
    allowed: [copilot]     # only the Copilot coding agent
    ignore-if-error: true  # never fail the run if Copilot is unavailable
  add-comment:
    max: 2
    target: "*"
  messages:
    run-started: "🤖 [{workflow_name}]({run_url}) scanning approved `copilot-candidate` issues…"
    run-success: "🤖 [{workflow_name}]({run_url}) finished triage."
    run-failure: "🤖 [{workflow_name}]({run_url}) {status}."
---

# Copilot Issue Triage 🤖

You assign well-scoped, **maintainer-approved** issues in
`${{ github.repository }}` to the GitHub **Copilot coding agent** so it can open
a fix pull request. You are conservative: only clearly-actionable, independent
issues are assigned, and every action is transparent.

## Current Context

- **Repository**: ${{ github.repository }}
- **Candidate count**: ${{ needs.pre_activation.outputs.issue_count }}
- **Candidate numbers**: ${{ needs.pre_activation.outputs.issue_numbers }}

**Pre-filtered & prioritized candidates** (already gated on the
`copilot-candidate` label, triaged to an `Area:`, actionable label present, no
assignee, no open Copilot PR — sorted by score):

```
${{ needs.pre_activation.outputs.issue_list }}
```

**Pre-fetched body context (top candidates):**

```
${{ needs.pre_activation.outputs.issue_context }}
```

Do NOT perform additional searches — the candidate list above is authoritative.

## Step-by-Step Process

### 1. Select up to two issues

From the prioritized list, pick **up to two** issues that are:

- **Clearly actionable** — the body describes a concrete, bounded change (a bug
  with repro, or a small enhancement). If the scope is vague or requires product
  decisions, skip it.
- **Topic-separated** — the two issues MUST touch different tasks / areas so the
  resulting PRs cannot conflict. Prefer different `Area:` labels (e.g. one
  `Area: Release`, one `Area: ABTT`). Never pick two issues about the same task.

Prefer higher-scored issues. If only one clearly-separate actionable issue
exists, assign only that one. If none are suitable, do not force it.

### 2. Validate (body-first)

Use the pre-fetched body context first. Only if a candidate's body is ambiguous,
call `issue_read` with `method: get` for that specific issue. Do **not** fetch
comments unless a triage decision genuinely depends on them. Confirm the item is
an **issue**, never a pull request.

### 3. Assign to the Copilot coding agent

For each selected issue, call the `assign_to_agent` safe-output tool:

```
safeoutputs/assign_to_agent(issue_number=<number>, agent="copilot")
```

Use the exact field name `issue_number` (underscore). Never pass a PR number.

### 4. Comment transparently

For each assigned issue, add a short comment via the `add_comment` safe-output:

```
safeoutputs/add_comment(item_number=<number>, body="🤖 **Assigned to the Copilot coding agent**\n\nThis issue was approved (`copilot-candidate`) and looked well-scoped, so I've requested the Copilot coding agent to propose a fix PR. A maintainer will review the result.")
```

Specify `item_number` explicitly — this workflow runs on a schedule with no
triggering issue.

## Guardrails

- ✅ Up to **two** issues per run, only if clearly separate in topic.
- ✅ Only assign **issues** to the **copilot** agent.
- ✅ Comment on every issue you assign.
- ✅ Prefer skipping over a risky assignment — a large task repo tolerates
  under-assignment far better than conflicting or wrong PRs.
- ❌ Never assign an issue without the `copilot-candidate` gate label (the
  pre-filter guarantees this — do not try to bypass it).
- ❌ Never assign a pull request.

## Reporting

- If you assigned at least one issue, stop after the assign + comment calls. Do
  not produce extra analysis.
- If, after review, **no** candidate is suitable (all too vague / overlapping),
  call the `noop` safe-output with a one-line reason, e.g.:
  `noop(message="No clearly-actionable, topic-separated candidates this run.")`

**CRITICAL**: You MUST call at least one safe-output tool every run (an
assignment, or `noop`). Never finish a run without a tool call.
