---
emoji: "🤖"
name: Copilot Issue Triage (POC)
description: >-
  Scheduled agentic workflow that nominates well-scoped issues (one label + a
  comment) for a maintainer to hand to the GitHub Copilot coding agent. This is
  the NOMINATION half; a maintainer approves by manually assigning Copilot, and
  the companion copilot-issue-triage-approved workflow does the post-assignment
  housekeeping. Adapted from github/gh-aw issue-monster for
  microsoft/azure-pipelines-tasks.

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
#   * The agent job is READ-ONLY and its ONLY capability is NOMINATION —
#     adding one nomination label and commenting. It has NO tool to assign
#     Copilot, so a crafted/injected issue body cannot trick the model into
#     handing work to the coding agent.
#   * Nomination + a manual human approval:
#       - `CONFIG.nominationLabel` (RM: `copilot-candidate-rm`) is BOT-applied.
#         The workflow adds it to at most `CONFIG.nominateCount` issues per run
#         to say "maintainer, please look at this".
#       - APPROVAL is a maintainer MANUALLY ASSIGNING the issue to the Copilot
#         coding agent from the issue UI. That manual assignment (a user action,
#         with a user token) is what starts Copilot — this workflow never assigns
#         Copilot itself. This is deliberate: assigning an agent is NOT permitted
#         with the Actions GITHUB_TOKEN (a GitHub App installation token returns
#         "Assigning agents is not supported…"), so the one security-sensitive
#         action stays firmly in human hands.
#   * Nomination is a TOP-UP model: the workflow keeps up to
#     `CONFIG.targetCandidateCount` (N) OUTSTANDING candidates (nominated but
#     still unassigned). When fewer than N are outstanding it nominates enough
#     NEW issues to top the pool back up to N, bounded by the per-run cap
#     `CONFIG.nominateCount`; when the pool is already at N it nominates nothing.
#   * `add-labels` is restricted to the nomination label only, capped per run.
#     The agent has no assign and no remove-label handler at all.
#   * A pre-activation search (github-script, READ-ONLY) does the heavy
#     filtering/scoring, so the model only reasons over a small candidate set.
#
# COMPANION WORKFLOW:
#   * `copilot-issue-triage-approved.yml` handles the OTHER half: it triggers
#     when the Copilot coding agent is ASSIGNED to an issue (the maintainer's
#     approval action) and does the deterministic housekeeping — removes this
#     nomination label, adds a `copilot-working` audit label, and comments. That
#     is why THIS workflow has no labeled/assigned trigger: approval and its
#     bookkeeping live entirely in the companion workflow.
#
# TRIGGERS:
#   * `schedule: daily` + `workflow_dispatch` — the ONLY triggers. Each run
#     builds a scored candidate pool and, if the outstanding-candidate pool is
#     below `CONFIG.targetCandidateCount`, the agent nominates enough new
#     candidates to top it back up. There is no label/assignment trigger here.
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
#          - `targetCandidateCount` N — how many OUTSTANDING candidates to keep
#                                 available (each run tops the pool up to N)
#          - `nominateCount`      per-run safety cap on NEW nominations
#                                 (must be <= the `add-labels.max` below)
#          - `areaLabels`         the `Area: …` labels your team owns
#          - `codeownersHandles`  CODEOWNERS handles whose `Tasks/*` you own
#                                 (use `[]` to scope by area labels only)
#          - `excludeLabels` / `priorityLabels`  optional per-team tuning
#     3. Create the nomination label in the repo up front, e.g.
#          gh label create copilot-candidate-<team> --color 0886dd
#     4. Edit the FRONTMATTER identity to match: `name`, `description`,
#        `schedule`, `safe-outputs.messages`, the per-run caps, and the
#        `add-labels` `allowed:` list (set it to YOUR team's nomination label).
#     5. `gh aw compile copilot-issue-triage-<team>` and commit both files.
#     6. Fork the companion workflow too (copilot-issue-triage-approved.yml):
#        set its NOMINATION_LABEL to your team's nomination label.
#   The RM team's filter is preserved by the CONFIG values shipped in THIS file.
# ---------------------------------------------------------------------------

on:
  workflow_dispatch:
  # Fuzzy daily schedule — gh-aw picks a stable per-repo time to avoid load
  # spikes. Keep infrequent for a POC; issue-monster runs every 30m.
  schedule: daily

  # Scopes for the pre-activation `steps:` below. Without this the pre-activation
  # job inherits the top-level `permissions: {}` and its GITHUB_TOKEN cannot
  # search issues, read CODEOWNERS, or enrich linked PRs. READ-ONLY: this step
  # never writes — nominating (label + comment) is done by the agent's
  # safe-outputs jobs, and assignment is a manual maintainer action handled by
  # the companion workflow.
  permissions:
    contents: read        # read .github/CODEOWNERS
    issues: read          # list/enrich candidate issues
    pull-requests: read   # linked-PR timeline nodes

  # Read-only pre-activation step: build a scored candidate pool and publish it
  # as job outputs for the agent to nominate from. It performs NO writes.
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
          // cap `safe-outputs.add-labels.max` / `add-comment.max` — must
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
            targetCandidateCount: 2,                     // N — desired number of OUTSTANDING candidates (nominated & still unassigned) to keep available for maintainers. Each run tops the pool back up to N.
            nominateCount: 2,                            // per-run safety cap: never nominate more than this many NEW issues in a single run (the run tops up toward targetCandidateCount, bounded by this)
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
          const excludeLabels = CONFIG.excludeLabels.map(l => l.toLowerCase());
          const priorityLabels = CONFIG.priorityLabels.map(l => l.toLowerCase());
          const scopeAreaLabels = CONFIG.areaLabels.map(l => l.toLowerCase());
          const scopeHandles = CONFIG.codeownersHandles.map(h => h.replace(/^@/, '').toLowerCase());
          // Normalize a task identifier: lowercase, drop a trailing "@<version>",
          // strip all non-alphanumerics.
          const normalizeTask = s =>
            (s || '').toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '');
          // Extract the "Task name" value from an issue-form body (rendered as a
          // "### Task name" heading followed by the value). Line-based so an
          // EMPTY field can't accidentally pull in unrelated text further down:
          // we take the first non-blank line after the heading, but stop at the
          // next heading (field left empty) and ignore the issue-form empty
          // placeholder "_No response_".
          const extractTaskName = body => {
            if (!body) return '';
            const lines = body.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (!/^#{1,6}\s*Task name\s*$/i.test(lines[i].trim())) continue;
              for (let j = i + 1; j < lines.length; j++) {
                const t = lines[j].trim();
                if (t === '') continue;               // skip the blank line forms insert
                if (t.startsWith('#')) return '';     // next section → field was empty
                if (/^_no response_$/i.test(t)) return '';  // issue-form empty placeholder
                return t;
              }
              return '';
            }
            return '';
          };

          // Every output the agent job consumes; defaults describe a no-op run.
          // NOTE: the agent's ONLY job is NOMINATION. It never assigns Copilot —
          // approval is a maintainer manually assigning the coding agent, and the
          // companion copilot-issue-triage-approved workflow handles the
          // post-assignment housekeeping.
          const out = {
            mode: 'noop',                     // 'scheduled' | 'noop'
            team: CONFIG.team,
            nomination_label: NOMINATION_LABEL,
            nominate_count: '0',              // how many NEW issues to nominate THIS run (top-up toward targetCandidateCount); set below
            nominate: 'false',                // whether to nominate new issues this run
            nominate_numbers: '',             // scored pool the agent picks from
            nominate_list: '',
            nominate_context: '',
            has_work: 'false',                // gates the agent job (nomination only)
          };
          const flush = () => { for (const [k, v] of Object.entries(out)) core.setOutput(k, v); };

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
              const prs = [];
              const MAX_PAGES = 5;   // up to 500 cross-references
              let cursor = null;
              try {
                for (let page = 0; page < MAX_PAGES; page++) {
                  const q = `query($owner:String!,$repo:String!,$number:Int!,$cursor:String){
                    repository(owner:$owner,name:$repo){ issue(number:$number){
                      timelineItems(first:100, after:$cursor, itemTypes:[CROSS_REFERENCED_EVENT]){
                        pageInfo { hasNextPage endCursor }
                        nodes{
                        ... on CrossReferencedEvent { source { __typename
                          ... on PullRequest { number state author { login } } } } } } } } }`;
                  const r = await github.graphql(q, { owner, repo, number, cursor });
                  const conn = r?.repository?.issue?.timelineItems;
                  for (const n of (conn?.nodes || [])) {
                    if (n?.source?.__typename === 'PullRequest') {
                      prs.push({ number: n.source.number, state: n.source.state, author: n.source.author?.login });
                    }
                  }
                  if (!conn?.pageInfo?.hasNextPage) return prs;
                  cursor = conn.pageInfo.endCursor;
                }
                core.warning(`Linked-PR scan for #${number} stopped at ${MAX_PAGES} pages (500 cross-refs); an existing Copilot PR beyond that could be missed.`);
                return prs;
              } catch (e) {
                core.warning(`Could not read linked PRs for #${number}: ${e.message}`);
                return prs;
              }
            };

            out.mode = 'scheduled';

            // NOMINATION — TOP-UP model. Maintain a steady pool of
            // `targetCandidateCount` (N) OUTSTANDING candidates (nominated but
            // not yet assigned to Copilot). List nominated issues directly
            // (read-after-write consistent + fully paged) and count those still
            // UNASSIGNED. If fewer than N are outstanding, nominate enough NEW
            // issues to top the pool back up to N (bounded by the per-run cap
            // `nominateCount`). Once a maintainer assigns Copilot (their approval
            // action), the issue drops out of this pending set, the deficit grows
            // and the next run refills it; the companion approved-processing
            // workflow removes the nomination label.
            const nominatedAll = await github.paginate(github.rest.issues.listForRepo, {
              owner, repo, state: 'open', labels: NOMINATION_LABEL, per_page: 100,
            });
            const pendingCount = nominatedAll
              .filter(i => !i.pull_request && (i.assignees || []).length === 0).length;
            // How many NEW candidates to add this run to reach N, capped per run.
            const deficit = CONFIG.targetCandidateCount - pendingCount;
            const slots = Math.max(0, Math.min(CONFIG.nominateCount, deficit));
            out.nominate_count = String(slots);
            if (slots <= 0) {
              core.info(`Nomination throttled: ${pendingCount} outstanding candidate(s) >= target of ${CONFIG.targetCandidateCount}. Nothing to top up.`);
            } else {
              core.info(`Nomination top-up: ${pendingCount} outstanding candidate(s) < target of ${CONFIG.targetCandidateCount}; nominating up to ${slots} more this run.`);
              // Pool = open, unassigned, not already nominated, not excluded.
              // The Search API is the right tool here (it expresses the `-label`
              // exclusions the Issues API can't), but it pages at 100. Walk up to
              // MAX_POOL_PAGES so an older high-priority issue (e.g. a p1 or a
              // regression that scores highest) isn't invisible just because 100+
              // newer issues match; warn if we still have to truncate.
              const poolQuery =
                `is:issue is:open repo:${owner}/${repo} no:assignee ` +
                `-label:"${NOMINATION_LABEL}" ` +
                excludeLabels.map(l => `-label:"${l}"`).join(' ');
              core.info(`Pool search: ${poolQuery}`);
              const MAX_POOL_PAGES = 10;   // Search API hard-caps at 1000 results
              const poolItems = [];
              let poolTotal = 0;
              for (let page = 1; page <= MAX_POOL_PAGES; page++) {
                const poolResp = await github.rest.search.issuesAndPullRequests({
                  q: poolQuery, per_page: 100, sort: 'created', order: 'desc', page,
                });
                poolTotal = poolResp.data.total_count;
                poolItems.push(...poolResp.data.items);
                if (poolItems.length >= poolTotal || poolResp.data.items.length === 0) break;
              }
              if (poolItems.length < poolTotal) {
                core.warning(`Pool truncated: fetched ${poolItems.length} of ${poolTotal} matching issues (cap ${MAX_POOL_PAGES} pages). Older issues beyond this window are not considered this run.`);
              }
              // Cheap scope + actionable filter on raw search items FIRST (they
              // already carry labels + body), THEN enrich survivors with linked
              // PRs — keeps the expensive GraphQL calls bounded.
              const prelim = poolItems.filter(i => inScope(i) && isActionable(i));
              core.info(`Pool: ${poolItems.length} open/unassigned fetched (of ${poolTotal}); ${prelim.length} pass scope+actionable.`);
              const survivors = [];
              // Copilot coding-agent PRs are authored by one of these exact bot
              // logins. Exact match avoids skipping a real user like "copilothelper".
              const COPILOT_PR_AUTHORS = new Set(['copilot-swe-agent', 'copilot']);
              for (const i of prelim) {
                const prs = await linkedPRs(i.number);
                if (prs.some(p => p.state === 'CLOSED' || p.state === 'MERGED')) {
                  core.info(`Skip #${i.number}: has closed/merged PR`); continue;
                }
                if (prs.some(p => p.state === 'OPEN' &&
                    COPILOT_PR_AUTHORS.has((p.author || '').toLowerCase()))) {
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

            out.has_work = out.nominate === 'true' ? 'true' : 'false';
            core.info(`Mode=${out.mode} nominate=${out.nominate} has_work=${out.has_work}`);
          } catch (error) {
            core.error(`Error in pre-activation: ${error.message}`);
          }
          flush();

# Only run the agent if the pre-activation step produced a nomination pool to
# pick from. The agent only nominates (label + comment); it never assigns
# Copilot — that is the maintainer's manual action.
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
      nominate_count: ${{ steps.search.outputs.nominate_count }}
      nominate: ${{ steps.search.outputs.nominate }}
      nominate_numbers: ${{ steps.search.outputs.nominate_numbers }}
      nominate_list: ${{ steps.search.outputs.nominate_list }}
      nominate_context: ${{ steps.search.outputs.nominate_context }}
      has_work: ${{ steps.search.outputs.has_work }}

safe-outputs:
  # The agent's ONLY capabilities are nominating candidates: adding the
  # nomination label and commenting. It has NO assign capability — assigning
  # Copilot is the maintainer's manual action, and the companion
  # copilot-issue-triage-approved workflow removes this nomination label after
  # assignment. So a crafted/injected issue cannot hand work to the coding agent.
  add-labels:
    max: 2
    target: "*"
    allowed: [copilot-candidate-rm]   # bot may only add the nomination label
  add-comment:
    max: 4
    target: "*"
  messages:
    run-started: "🤖 [{workflow_name}]({run_url}) nominating candidates…"
    run-success: "🤖 [{workflow_name}]({run_url}) finished nominating."
    run-failure: "🤖 [{workflow_name}]({run_url}) {status}."
---

# Copilot Issue Triage 🤖

You are the **nomination** step of a nomination → approval flow for the
`${{ github.repository }}` repository. A maintainer always has the final say
before the GitHub **Copilot coding agent** is asked to work on an issue.

**Your only job is to NOMINATE candidates.** You do not — and cannot — assign
issues to Copilot. Approval is a maintainer manually assigning the Copilot coding
agent to the issue from the GitHub UI; you never do it, and you have no tool to
do it.

There is one label you use:

- **Nomination label** `${{ needs.pre_activation.outputs.nomination_label }}` — **you** apply this to flag an issue you think is a good Copilot candidate.

Approval is not a label — it is the maintainer **assigning Copilot** to the issue.

What happens after you nominate an issue:

1. A maintainer reviews the nominated issue.
2. If they agree, they **assign the Copilot coding agent** to it from the issue
   UI (the "Assignees" picker). That manual assignment is the approval and is
   what starts Copilot.
3. A companion workflow then removes the nomination label, adds a
   `copilot-working` label, and comments confirming Copilot is on it.
4. Copilot opens a draft pull request proposing a fix; a maintainer reviews it.

## Current Context

- **Repository**: ${{ github.repository }}
- **Team**: ${{ needs.pre_activation.outputs.team }}
- **Run mode**: ${{ needs.pre_activation.outputs.mode }}
- **Nomination label**: `${{ needs.pre_activation.outputs.nomination_label }}`
- **Should nominate this run**: ${{ needs.pre_activation.outputs.nominate }}
- **How many to nominate**: ${{ needs.pre_activation.outputs.nominate_count }}

**Nomination pool — prioritized candidates awaiting nomination** (open, in-scope
for this team, actionable label present, no assignee, no open Copilot PR, not yet
nominated — sorted by score):

```
${{ needs.pre_activation.outputs.nominate_list }}
```

**Pre-fetched body context (top nomination candidates):**

```
${{ needs.pre_activation.outputs.nominate_context }}
```

Do NOT perform additional searches — the lists above are authoritative.

## Step-by-Step Process

Nominate only if **Should nominate this run** is `true`. From the nomination pool,
pick **up to ${{ needs.pre_activation.outputs.nominate_count }}** issues that are:

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
2. **Comment asking a maintainer to approve, and spell out what will happen next.**
   The comment MUST tell the maintainer exactly how to approve (assign Copilot)
   and what happens after. Use this body, keeping the numbered "what happens
   after you assign Copilot" steps:
   ```
   safeoutputs/add_comment(item_number=<number>, body="🤖 **Nominated as a Copilot candidate**\n\nThis issue looks well-scoped for the GitHub Copilot coding agent.\n\n**Maintainer — if you agree, assign the Copilot coding agent to this issue** (use the **Assignees** picker on the right and choose **Copilot** — it may appear as **`copilot-swe-agent`**). That manual assignment is the approval. Here is what happens once you do:\n\n1. Copilot starts working on the issue and opens a draft pull request proposing a fix.\n2. A companion workflow removes the `${{ needs.pre_activation.outputs.nomination_label }}` nomination label and adds a `copilot-working` label so the status is visible.\n3. A maintainer reviews that PR — nothing is merged automatically.\n\nIf this isn't a good fit, just remove the nomination label and no further action is taken.")
   ```

Do **NOT** assign nominated issues to Copilot (you have no such tool) — assigning
Copilot is the maintainer's manual approval action.

### Validation (body-first)

Use the pre-fetched body context first. Only if a candidate's body is ambiguous,
call `issue_read` with `method: get` for that specific issue. Confirm each item
is an **issue**, never a pull request.

## Guardrails

- ✅ NOMINATE at most ${{ needs.pre_activation.outputs.nominate_count }} per run.
- ✅ Comment on every issue you nominate, and always include the "what happens
  after you assign Copilot" steps so the maintainer knows how to approve and what
  the consequence is.
- ✅ Prefer skipping over a risky nomination — under-nominating is far safer than
  nominating a vague or overlapping issue.
- ❌ Never try to assign an issue or a pull request to Copilot — you have no
  assignment tool; assigning Copilot is the maintainer's manual approval action.

## Reporting

- After nominating (or deciding there is nothing to nominate), stop. Do not
  produce extra analysis.
- If there is genuinely nothing suitable to nominate, call the `noop` safe-output
  with a one-line reason, e.g.:
  `noop(message="No clearly-actionable, well-separated candidates to nominate this run.")`

**CRITICAL**: You MUST call at least one safe-output tool every run (a label add,
a comment, or `noop`). Never finish a run without a tool call.
