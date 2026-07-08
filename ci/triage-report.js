// Customizable GitHub issue triage report (entry point / orchestrator).
//
// Parses configuration + scope from environment variables, fetches issues,
// then delegates report rendering to ./triage-report/report and email delivery
// to ./triage-report/mailer. Driven entirely by env vars so several teams can
// reuse the same workflow with their own inputs/secrets.
//
// The report always renders to the Actions job summary; email is sent only
// when SMTP_* secrets are configured, so it is safe to run before a team has
// wired up its mail secrets.
//
// Inputs (env):
//   GITHUB_REPOSITORY  owner/repo (provided by Actions)
//   GITHUB_PAT         token with issues:read (secrets.GITHUB_TOKEN is enough)
//   AREAS              comma/newline separated Area labels, e.g. "Area: Release, Area:RM"
//   OWNERS             space/comma separated CODEOWNERS handles, e.g. "@manolerazvan @microsoft/release-management-task-team"
//   CODEOWNERS_PATH    optional; default auto-detects .github/CODEOWNERS | CODEOWNERS | docs/CODEOWNERS
//   REPORT_TITLE       optional; default "Triage Report"
//   TOP_TASKS          optional; default 12
//   WEEKS              optional; default 4
//   TRIAGE_FIXTURES    optional; dir with open.json/created.json/closed.json for offline dry runs
//   WRITE_FILES        optional; "true" writes triage-report.html/.txt to cwd
// Mail (env / secrets): see ./triage-report/mailer.js

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { buildReport } = require('./triage-report/report');
const { sendMail } = require('./triage-report/mailer');

// ---------- config ----------
const [OWNER, REPO] = (process.env.GITHUB_REPOSITORY || 'microsoft/azure-pipelines-tasks').split('/');
const TOKEN = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
const REPORT_TITLE = process.env.REPORT_TITLE || 'Triage Report';
const TOP_TASKS = parseInt(process.env.TOP_TASKS || '12', 10);
const NWEEKS = Math.max(1, Math.min(12, parseInt(process.env.WEEKS || '4', 10)));

const splitList = s => (s || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
const areaInputs = splitList(process.env.AREAS);
const ownerInputs = (process.env.OWNERS || '').split(/[\s,]+/).map(x => x.trim()).filter(Boolean);

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/v\d+$/, '');

if (!areaInputs.length && !ownerInputs.length) {
  console.error('ERROR: provide at least one of AREAS or OWNERS to define the report scope.');
  process.exit(1);
}

// ---------- CODEOWNERS -> owned task set ----------
function readCodeowners() {
  const explicit = process.env.CODEOWNERS_PATH;
  const candidates = explicit ? [explicit] : ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];
  for (const c of candidates) {
    try { return fs.readFileSync(path.resolve(c), 'utf8'); } catch { /* try next */ }
  }
  return '';
}
function ownedTasks(text, owners) {
  const ownerSet = new Set(owners.map(o => o.toLowerCase()));
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const parts = t.split(/\s+/);
    const lineOwners = parts.slice(1).map(x => x.toLowerCase());
    if (!lineOwners.some(o => ownerSet.has(o))) continue;
    const m = parts[0].replace(/^\/+/, '').match(/^Tasks\/([^/]+)/i);
    if (m) set.add(norm(m[1]));
  }
  return set;
}
const ownedSet = ownerInputs.length ? ownedTasks(readCodeowners(), ownerInputs) : new Set();

// ---------- fetch ----------
const octokit = new Octokit({ auth: TOKEN });
const now = Date.now();
const winDays = NWEEKS * 7 + 3;
const sinceISO = new Date(now - winDays * 86400000).toISOString().slice(0, 10);

async function fetchAll() {
  // Offline dry-run: load open.json / created.json / closed.json from a fixtures
  // directory instead of hitting the API (useful for local testing / CI dry-runs).
  if (process.env.TRIAGE_FIXTURES) {
    const dir = process.env.TRIAGE_FIXTURES;
    const load = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const open = load('open.json');
    return { open: open.filter(i => !i.pull_request), created: load('created.json'), closed: load('closed.json') };
  }
  const open = await octokit.paginate(octokit.issues.listForRepo, { owner: OWNER, repo: REPO, state: 'open', per_page: 100 });
  const created = await octokit.paginate(octokit.search.issuesAndPullRequests, { q: `repo:${OWNER}/${REPO} is:issue created:>=${sinceISO}`, per_page: 100 });
  const closed = await octokit.paginate(octokit.search.issuesAndPullRequests, { q: `repo:${OWNER}/${REPO} is:issue closed:>=${sinceISO}`, per_page: 100 });
  return { open: open.filter(i => !i.pull_request), created, closed };
}

(async () => {
  const date = new Date().toISOString().slice(0, 10);
  console.log(`Scope: areas=[${areaInputs.join(', ')}] owners=[${ownerInputs.join(', ')}] ownedTasks=${ownedSet.size}`);
  const data = await fetchAll();
  console.log(`Fetched: open=${data.open.length} created(win)=${data.created.length} closed(win)=${data.closed.length}`);
  // The GitHub search API hard-caps at 1000 results; if we hit it the window
  // counts are a floor and the dynamics columns under-report closures.
  if (data.created.length >= 1000 || data.closed.length >= 1000) {
    console.warn('WARNING: hit the 1000-result search cap; weekly opened/closed counts may be undercounted. Reduce WEEKS or narrow scope.');
  }

  const cfg = {
    owner: OWNER, repo: REPO, reportTitle: REPORT_TITLE, topTasks: TOP_TASKS, nweeks: NWEEKS,
    areaInputs, ownerInputs, ownedSet, now, date,
  };
  const { text, html, stats } = buildReport(data, cfg);
  console.log(`Report: in-scope=${stats.total} sla=${stats.sla} regressions=${stats.regressions} new7=${stats.new7}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${REPORT_TITLE} \u2014 ${date}\n\n\`\`\`\n${text}\n\`\`\`\n`);
  }
  if (process.env.WRITE_FILES === 'true') {
    fs.writeFileSync('triage-report.html', html);
    fs.writeFileSync('triage-report.txt', text);
  }

  // Email is best-effort: the report is already in the job summary, so a mail
  // relay failure must not fail the run.
  try {
    await sendMail(`${REPORT_TITLE} \u2014 ${date}`, html, text);
  } catch (e) {
    console.warn('WARNING: email delivery failed (report is still in the job summary):', e.message);
  }
})().catch(e => { console.error(e); process.exit(1); });
