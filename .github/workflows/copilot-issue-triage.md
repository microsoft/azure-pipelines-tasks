---
emoji: "🤖"
name: Copilot Issue Triage (POC)
description: >-
  Scheduled agentic workflow that nominates well-scoped issues for a maintainer
  to approve, then assigns approved issues to the GitHub Copilot coding agent for
  a fix PR. Two-label nomination→approval handshake. Adapted from github/gh-aw
  issue-monster for microsoft/azure-pipelines-tasks.

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
#   * Two-label nomination → approval handshake, configured per team:
#       - `CONFIG.nominationLabel` (RM: `copilot-candidate-rm`) is BOT-applied.
#         The workflow adds it to at most `CONFIG.nominateCount` issues per
#         scheduled run to say "maintainer, please look at this".
#       - `CONFIG.approvalLabel` (RM: `copilot-approved-rm`) is MAINTAINER-applied
#         by hand. The workflow only READS it — it NEVER adds the approval label.
#     Copilot is assigned ONLY to issues that carry BOTH labels, so nothing is
#     handed to the agent without an explicit human go-signal.
#   * Nomination is throttled: if any issue is already nominated-but-unapproved,
#     the workflow nominates nothing new until the maintainer clears the queue.
#   * `assign-to-agent` is restricted to the `copilot` agent, capped per run,
#     and `ignore-if-error` so a temporarily-unavailable agent never fails CI.
#     `add-labels` / `remove-labels` are restricted to the nomination label only.
#   * A pre-activation search (github-script) does the heavy filtering/scoring
#     deterministically, so the model only reasons over a small candidate set.
#
# TRIGGERS:
#   * `schedule: daily` + `workflow_dispatch` — the main loop: confirm approved
#     issues, then (if the queue is clear) nominate new candidates.
#   * `issues: types: [labeled]` — instant path: the moment a maintainer adds
#     the approval label to a nominated issue, assign it within seconds instead
#     of waiting for the next scheduled run. The pre-activation step exits as a
#     no-op for every other label add.
#
# FORK FOR YOUR TEAM (this workflow is generic; RM is the shipped example):
#   Each area team runs its OWN copy of this workflow. To create one:
#     1. Copy this file to `.github/workflows/copilot-issue-triage-<team>.md`.
#     2. Edit the `CONFIG = { … }` block in the pre-activation script (the ONLY
#        place with team-specific filter values):
#          - `team`               display name for logs
#          - `nominationLabel`    a DISTINCT bot-applied label per team so teams
#                                 do not pick each other's issues (e.g.
#                                 `copilot-candidate-artifacts`)
#          - `approvalLabel`      a DISTINCT maintainer-applied approval label
#                                 per team (e.g. `copilot-approved-artifacts`)
#          - `nominateCount`      how many issues to nominate per scheduled run
#          - `areaLabels`         the `Area: …` labels your team owns
#          - `codeownersHandles`  CODEOWNERS handles whose `Tasks/*` you own
#                                 (use `[]` to scope by area labels only)
#          - `excludeLabels` / `priorityLabels`  optional per-team tuning
#     3. Create BOTH labels in the repo up front (the approval label must exist
#        so maintainers can apply it): e.g.
#          gh label create copilot-candidate-<team> --color 0886dd
#          gh label create copilot-approved-<team>  --color 0E8A16
#     4. Edit the FRONTMATTER identity to match: `name`, `description`,
#        `schedule`, `safe-outputs.messages`, the per-run caps, and the
#        `add-labels` / `remove-labels` `allowed:` lists (set them to YOUR
#        team's nomination label).
#     5. `gh aw compile copilot-issue-triage-<team>` and commit both files.
#   The RM team's filter is preserved by the CONFIG values shipped in THIS file.
# ---------------------------------------------------------------------------

on:
  workflow_dispatch:
  # Fuzzy daily schedule — gh-aw picks a stable per-repo time to avoid load
  # spikes. Keep infrequent for a POC; issue-monster runs every 30m.
  schedule: daily

  # Instant confirmation path: when a maintainer adds the approval label to a
  # nominated issue, process it within seconds instead of waiting for the daily
  # run. The pre-activation step no-ops for any other label.
  issues:
    types: [labeled]

  # Least-privilege read scopes for the pre-activation `steps:` below. Without
  # this the pre-activation job inherits the top-level `permissions: {}` and its
  # GITHUB_TOKEN cannot search issues, read CODEOWNERS, enrich linked PRs, or run
  # the role check — the run would fail. (This is separate from the agent job's
  # `permissions:` block further down.)
  permissions:
    contents: read        # read .github/CODEOWNERS
    issues: read          # search issues + linked-PR enrichment + role check
    pull-requests: read   # linked-PR timeline nodes

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
            nominationLabel: 'copilot-candidate-rm',     // BOT-applied: marks an issue the workflow nominated for review
            approvalLabel: 'copilot-approved-rm',        // MAINTAINER-applied (manual): the go-signal to assign Copilot
            nominateCount: 2,                            // how many issues to nominate per scheduled run
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

          const NOMINATION_LABEL = CONFIG.nominationLabel;   // bot-applied
          const APPROVAL_LABEL = CONFIG.approvalLabel;       // maintainer-applied
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
          const hasLbl = (iss, name) =>
            (iss.labels || []).map(l => (l.name || l).toLowerCase()).includes(name.toLowerCase());
          const snippet = i => {
            const body = (i.body || '').replace(/\s+/g, ' ').trim();
            const snip = body.length > BODY_SNIPPET_MAX_LENGTH ? `${body.slice(0, BODY_SNIPPET_MAX_LENGTH)}…` : body;
            const labs = (i.labels || []).map(l => l.name || l).join(', ');
            return `#${i.number} | ${i.title}\nlabels=${labs}\nBody: ${snip || '(no body)'}`;
          };

          // Every output the agent job consumes; defaults describe a no-op run.
          const out = {
            mode: 'noop',                     // 'scheduled' | 'confirm-event' | 'noop'
            team: CONFIG.team,
            nomination_label: NOMINATION_LABEL,
            approval_label: APPROVAL_LABEL,
            nominate_count: String(CONFIG.nominateCount),
            confirm_numbers: '',              // issues to assign to Copilot (both labels present)
            confirm_context: '',
            nominate: 'false',                // whether to nominate new issues this run
            nominate_numbers: '',             // scored pool the agent picks from
            nominate_list: '',
            nominate_context: '',
            has_work: 'false',                // gates the agent job
          };
          const flush = () => { for (const [k, v] of Object.entries(out)) core.setOutput(k, v); };

          try {
            // ---- Fast path: instant confirmation on issues.labeled ----------
            // Fires for EVERY label added anywhere in the repo, so exit unless
            // the added label is our approval label AND the issue is one we
            // previously nominated. No CODEOWNERS read / search needed here.
            if (context.eventName === 'issues' && context.payload?.action === 'labeled') {
              const added = (context.payload.label?.name || '').toLowerCase();
              const issue = context.payload.issue;
              if (added !== APPROVAL_LABEL.toLowerCase()) {
                core.info(`Ignoring labeled event: '${context.payload.label?.name}' is not the approval label.`);
              } else if (!hasLbl(issue, NOMINATION_LABEL)) {
                core.info(`#${issue.number} got approval label but has no nomination label — ignoring.`);
              } else if ((issue.assignees || []).length > 0) {
                // Someone is already working this issue — don't hand it to
                // Copilot and clobber a manual assignment.
                core.info(`#${issue.number} approved but already assigned to ${(issue.assignees || []).map(a => a.login).join(', ')} — skipping.`);
              } else {
                out.mode = 'confirm-event';
                out.confirm_numbers = String(issue.number);
                out.confirm_context = snippet(issue);
                out.has_work = 'true';
                core.info(`Confirm (event): will assign Copilot to #${issue.number}`);
              }
              flush();
              return;
            }

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

            // ---- Shared filters/helpers (scheduled path) -------------------
            const inScope = (issue) => {
              const labels = (issue.labels || []).map(l => (l.name || l).toLowerCase());
              const inScopeArea = labels.some(l => scopeAreaLabels.includes(l));
              const taskLabelMatch = labels
                .filter(l => l.startsWith('task:'))
                .map(l => normalizeTask(l.slice('task:'.length)))
                .some(t => t && ownedTasks.has(t));
              const bodyTask = normalizeTask(extractTaskName(issue.body));
              const taskBodyMatch = !!bodyTask && ownedTasks.has(bodyTask);
              return inScopeArea || taskLabelMatch || taskBodyMatch;
            };
            const isActionable = (issue) =>
              (issue.labels || []).map(l => (l.name || l).toLowerCase())
                .some(l => priorityLabels.includes(l));
            const scoreOf = (issue) => {
              const labels = (issue.labels || []).map(l => (l.name || l).toLowerCase());
              let score = 0;
              if (labels.includes('good first issue') || labels.includes('good-first-issue')) score += 50;
              if (labels.includes('help wanted')) score += 40;
              if (labels.includes('p1')) score += 45;
              if (labels.includes('regression')) score += 40;
              if (labels.includes('bug')) score += 35;
              if (labels.includes('enhancement')) score += 25;
              const ageDays = Math.floor((Date.now() - new Date(issue.created_at)) / 86400000);
              return score + Math.min(ageDays / 10, 20);
            };
            const linkedPRs = async (number) => {
              try {
                const q = `query($owner:String!,$repo:String!,$number:Int!){
                  repository(owner:$owner,name:$repo){ issue(number:$number){
                    timelineItems(first:100, itemTypes:[CROSS_REFERENCED_EVENT]){ nodes{
                      ... on CrossReferencedEvent { source { __typename
                        ... on PullRequest { number state author { login } } } } } } } } }`;
                const r = await github.graphql(q, { owner, repo, number });
                return (r?.repository?.issue?.timelineItems?.nodes || [])
                  .filter(n => n?.source?.__typename === 'PullRequest')
                  .map(n => ({ number: n.source.number, state: n.source.state, author: n.source.author?.login }));
              } catch (e) {
                core.warning(`Could not read linked PRs for #${number}: ${e.message}`);
                return [];
              }
            };

            out.mode = 'scheduled';

            // (A) CONFIRM SET — issues a maintainer has approved (BOTH labels
            // present) and that nobody is already assigned to. Separate label:
            // filters are ANDed. These get assigned to the Copilot agent this run.
            const confirmQuery =
              `is:issue is:open repo:${owner}/${repo} no:assignee ` +
              `label:"${NOMINATION_LABEL}" label:"${APPROVAL_LABEL}"`;
            core.info(`Confirm search: ${confirmQuery}`);
            const confirmResp = await github.rest.search.issuesAndPullRequests({
              q: confirmQuery, per_page: 100,
            });
            const confirmItems = confirmResp.data.items;
            out.confirm_numbers = confirmItems.map(i => i.number).join(',');
            out.confirm_context = confirmItems
              .slice(0, MAX_ISSUES_WITH_BODY_CONTEXT).map(snippet).join('\n\n---\n\n');
            core.info(`Confirm set: ${confirmItems.length} approved issue(s).`);

            // (B) NOMINATION — only when nothing is already awaiting approval,
            // so we never pile up more than nominateCount pending nominations.
            const pendingQuery =
              `is:issue is:open repo:${owner}/${repo} ` +
              `label:"${NOMINATION_LABEL}" -label:"${APPROVAL_LABEL}"`;
            const pendingResp = await github.rest.search.issuesAndPullRequests({
              q: pendingQuery, per_page: 1,
            });
            const pendingCount = pendingResp.data.total_count;
            if (pendingCount > 0) {
              core.info(`Nomination throttled: ${pendingCount} issue(s) nominated & awaiting maintainer approval.`);
            } else {
              // Pool = open, unassigned, not already in the handshake, not excluded.
              const poolQuery =
                `is:issue is:open repo:${owner}/${repo} no:assignee ` +
                `-label:"${NOMINATION_LABEL}" -label:"${APPROVAL_LABEL}" ` +
                excludeLabels.map(l => `-label:"${l}"`).join(' ');
              core.info(`Pool search: ${poolQuery}`);
              const poolResp = await github.rest.search.issuesAndPullRequests({
                q: poolQuery, per_page: 100, sort: 'created', order: 'desc',
              });
              // Cheap scope + actionable filter on raw search items FIRST (they
              // already carry labels + body), THEN enrich survivors with linked
              // PRs — keeps the expensive GraphQL calls bounded.
              const prelim = poolResp.data.items.filter(i => inScope(i) && isActionable(i));
              core.info(`Pool: ${poolResp.data.total_count} open/unassigned; ${prelim.length} pass scope+actionable.`);
              const survivors = [];
              for (const i of prelim) {
                const prs = await linkedPRs(i.number);
                if (prs.some(p => p.state === 'CLOSED' || p.state === 'MERGED')) {
                  core.info(`Skip #${i.number}: has closed/merged PR`); continue;
                }
                if (prs.some(p => p.state === 'OPEN' &&
                    (p.author === 'copilot-swe-agent' || (p.author || '').includes('copilot')))) {
                  core.info(`Skip #${i.number}: open Copilot PR`); continue;
                }
                survivors.push(i);
              }
              const scored = survivors.map(i => ({
                number: i.number, title: i.title,
                labels: (i.labels || []).map(l => l.name || l),
                body: i.body, created_at: i.created_at, score: scoreOf(i),
              })).sort((a, b) => b.score - a.score);
              core.info(`Nomination pool after filtering: ${scored.length} candidate(s).`);
              if (scored.length) {
                out.nominate = 'true';
                out.nominate_numbers = scored.map(i => i.number).join(',');
                out.nominate_list = scored.map(i =>
                  `#${i.number}: ${i.title} [${i.labels.join(', ')}] (score: ${i.score.toFixed(1)})`).join('\n');
                out.nominate_context = scored.slice(0, MAX_ISSUES_WITH_BODY_CONTEXT).map(i => {
                  const body = (i.body || '').replace(/\s+/g, ' ').trim();
                  const snip = body.length > BODY_SNIPPET_MAX_LENGTH ? `${body.slice(0, BODY_SNIPPET_MAX_LENGTH)}…` : body;
                  return `#${i.number} | score=${i.score.toFixed(1)} | labels=${i.labels.join(', ')}\nTitle: ${i.title}\nBody: ${snip || '(no body)'}`;
                }).join('\n\n---\n\n');
              }
            }

            out.has_work = (out.confirm_numbers || out.nominate === 'true') ? 'true' : 'false';
            core.info(`Mode=${out.mode} confirm=[${out.confirm_numbers}] nominate=${out.nominate} has_work=${out.has_work}`);
          } catch (error) {
            core.error(`Error in pre-activation: ${error.message}`);
          }
          flush();

# Only run the agent if the pre-activation step found work (a confirmed issue
# to assign, or a fresh nomination pool to pick from).
if: needs.pre_activation.outputs.has_work == 'true'

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
      mode: ${{ steps.search.outputs.mode }}
      team: ${{ steps.search.outputs.team }}
      nomination_label: ${{ steps.search.outputs.nomination_label }}
      approval_label: ${{ steps.search.outputs.approval_label }}
      nominate_count: ${{ steps.search.outputs.nominate_count }}
      confirm_numbers: ${{ steps.search.outputs.confirm_numbers }}
      confirm_context: ${{ steps.search.outputs.confirm_context }}
      nominate: ${{ steps.search.outputs.nominate }}
      nominate_numbers: ${{ steps.search.outputs.nominate_numbers }}
      nominate_list: ${{ steps.search.outputs.nominate_list }}
      nominate_context: ${{ steps.search.outputs.nominate_context }}
      has_work: ${{ steps.search.outputs.has_work }}

safe-outputs:
  assign-to-agent:
    max: 2
    target: "*"            # requires explicit issue_number in agent output
    allowed: [copilot]     # only the Copilot coding agent
    ignore-if-error: true  # never fail the run if Copilot is unavailable
  add-labels:
    max: 2
    target: "*"
    allowed: [copilot-candidate-rm]   # bot may only add the nomination label
  remove-labels:
    max: 2
    target: "*"
    allowed: [copilot-candidate-rm]   # cleanup after a confirmed issue is assigned
  add-comment:
    max: 4
    target: "*"
  messages:
    run-started: "🤖 [{workflow_name}]({run_url}) checking approvals & nominating candidates…"
    run-success: "🤖 [{workflow_name}]({run_url}) finished triage."
    run-failure: "🤖 [{workflow_name}]({run_url}) {status}."
---

# Copilot Issue Triage 🤖

You run a **two-step nomination → approval handshake** for the `${{ github.repository }}`
repository so that a maintainer always has the final say before the GitHub
**Copilot coding agent** is asked to work on an issue.

There are two labels in play:

- **Nomination label** `${{ needs.pre_activation.outputs.nomination_label }}` — **you** apply this to flag an issue you think is a good Copilot candidate.
- **Approval label** `${{ needs.pre_activation.outputs.approval_label }}` — a **maintainer** applies this manually. It is the go-signal. You NEVER add this label yourself; you only react to issues that already have it.

Depending on what the pre-activation step found, this run does **one or both** of:

1. **CONFIRM** — assign already-approved issues (both labels present) to the Copilot agent.
2. **NOMINATE** — mark the most actionable un-nominated issues with the nomination label and ask a maintainer to approve.

## Current Context

- **Repository**: ${{ github.repository }}
- **Team**: ${{ needs.pre_activation.outputs.team }}
- **Run mode**: ${{ needs.pre_activation.outputs.mode }}
- **Nomination label**: `${{ needs.pre_activation.outputs.nomination_label }}`
- **Approval label**: `${{ needs.pre_activation.outputs.approval_label }}`
- **Approved & ready to assign (CONFIRM)**: ${{ needs.pre_activation.outputs.confirm_numbers }}
- **Should nominate this run**: ${{ needs.pre_activation.outputs.nominate }}
- **How many to nominate**: ${{ needs.pre_activation.outputs.nominate_count }}

**Approved issues to assign (CONFIRM set):**

```
${{ needs.pre_activation.outputs.confirm_context }}
```

**Nomination pool — prioritized candidates awaiting nomination** (open, in-scope
for this team, actionable label present, no assignee, no open Copilot PR, not yet
in the handshake — sorted by score):

```
${{ needs.pre_activation.outputs.nominate_list }}
```

**Pre-fetched body context (top nomination candidates):**

```
${{ needs.pre_activation.outputs.nominate_context }}
```

Do NOT perform additional searches — the lists above are authoritative.

## Step-by-Step Process

### Phase A — CONFIRM (assign approved issues)

For **every** issue number in the CONFIRM set above (may be empty):

1. **Assign it to the Copilot coding agent:**
   ```
   safeoutputs/assign_to_agent(issue_number=<number>, agent="copilot")
   ```
   Use the exact field name `issue_number` (underscore). Never pass a PR number.
2. **Remove the nomination label** (cleanup — the approval label stays as an audit trail):
   ```
   safeoutputs/remove_labels(item_number=<number>, labels=["${{ needs.pre_activation.outputs.nomination_label }}"])
   ```
3. **Comment transparently:**
   ```
   safeoutputs/add_comment(item_number=<number>, body="🤖 **Assigned to the Copilot coding agent**\n\nA maintainer approved this issue, so I've handed it to the Copilot coding agent to propose a fix PR. A maintainer will review the result.")
   ```

If the CONFIRM set is empty, skip Phase A entirely.

### Phase B — NOMINATE (flag candidates for approval)

Only if **Should nominate this run** is `true`. From the nomination pool, pick
**up to ${{ needs.pre_activation.outputs.nominate_count }}** issues that are:

- **Clearly actionable** — the body describes a concrete, bounded change (a bug
  with repro, or a small enhancement). If the scope is vague or requires product
  decisions, skip it.
- **Topic-separated** — the chosen issues MUST touch different tasks / areas so
  the eventual PRs cannot conflict. Prefer different `Area:` / `Task:` labels.
  Never pick two issues about the same task.

Prefer higher-scored issues. If only one clearly-separate actionable issue
exists, nominate only that one. If none are suitable, nominate none.

For **each** issue you decide to nominate:

1. **Add the nomination label:**
   ```
   safeoutputs/add_labels(item_number=<number>, labels=["${{ needs.pre_activation.outputs.nomination_label }}"])
   ```
2. **Comment asking a maintainer to approve:**
   ```
   safeoutputs/add_comment(item_number=<number>, body="🤖 **Nominated as a Copilot candidate**\n\nThis issue looks well-scoped for the Copilot coding agent. A maintainer: if you agree, add the **`${{ needs.pre_activation.outputs.approval_label }}`** label and I'll hand it to Copilot to propose a fix PR.")
   ```

Do **NOT** assign nominated issues to Copilot in this phase, and do **NOT** add
the approval label yourself — approval is a human action.

### Validation (both phases, body-first)

Use the pre-fetched body context first. Only if a candidate's body is ambiguous,
call `issue_read` with `method: get` for that specific issue. Confirm each item
is an **issue**, never a pull request.

## Guardrails

- ✅ CONFIRM every approved issue in the set; NOMINATE at most
  ${{ needs.pre_activation.outputs.nominate_count }} per run.
- ✅ Only assign **issues** to the **copilot** agent.
- ✅ Comment on every issue you act on.
- ✅ Prefer skipping over a risky nomination — under-nominating is far safer than
  nominating a vague or overlapping issue.
- ❌ Never add the approval label `${{ needs.pre_activation.outputs.approval_label }}` — that is the maintainer's manual go-signal.
- ❌ Never assign an issue that a maintainer has not approved.
- ❌ Never assign a pull request.

## Reporting

- After completing the applicable phase(s), stop. Do not produce extra analysis.
- If there is genuinely nothing to do (empty CONFIRM set and no suitable
  nomination candidate), call the `noop` safe-output with a one-line reason, e.g.:
  `noop(message="No approved issues to assign and no clearly-actionable candidates to nominate.")`

**CRITICAL**: You MUST call at least one safe-output tool every run (an
assignment, a label change, a comment, or `noop`). Never finish a run without a
tool call.
