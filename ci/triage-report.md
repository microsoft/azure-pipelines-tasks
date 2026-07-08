# Customizable issue triage report

`ci/triage-report.js` builds a scoped GitHub issue triage report (HTML + text)
and emails it. It is designed so **several teams can reuse one engine** with
their own scope and their own mail secrets.

- Engine workflow (reusable): [`.github/workflows/triage-report.yml`](../.github/workflows/triage-report.yml)
- Example caller: [`.github/workflows/triage-report-release-rm.yml`](../.github/workflows/triage-report-release-rm.yml)
- Report generator: [`ci/triage-report.js`](./triage-report.js)

## What the report contains

- Headline metrics: in-scope open, unassigned %, stale >30d, SLA backlog, new (7d).
- **Scope breakdown** and **Top tasks in scope**, each with the last *N* weeks of
  `net (opened / closed)` per week.
- **Type dynamics** (regression / bug / enhancement / question / untyped) with the
  same weekly columns.
- Perspectives: regression spotlight (with breaking &larr; last-working version),
  community demand (top +1), first-response gap (0 comments), aging cohorts + inflow.

## Defining scope

Scope is the union of:

- **`areas`** &mdash; Area labels to include, e.g. `Area: Release, Area:RM`
  (whitespace-insensitive, so `Area:RM` and `Area: RM` both match).
- **`owners`** &mdash; CODEOWNERS handles (users or teams). Every `Tasks/<Folder>/`
  entry owned by any listed handle is in scope; an issue matches when its
  `Task: <name>` label maps to one of those folders. Handles are read from
  `.github/CODEOWNERS` in the checked-out repo.

Provide at least one of `areas` or `owners`.

## Adding a report for your team

1. Copy `triage-report-release-rm.yml` to
   `.github/workflows/triage-report-<team>.yml`.
2. Set `areas` / `owners` / `report_title` under `with:`.
3. Create your mail secrets and map them under `secrets:`.
4. Uncomment the `schedule:` trigger (default weekly) or keep it manual.

## Email delivery

Email is sent via SMTP using these secrets (all optional; email is skipped when
`MAIL_TO` or `SMTP_SERVER` is missing):

| Secret | Purpose |
| --- | --- |
| `MAIL_TO` | Recipient(s), comma-separated |
| `MAIL_FROM` | From address (defaults to `SMTP_USERNAME`) |
| `SMTP_SERVER` | SMTP relay host |
| `SMTP_PORT` | Port (default 587; 465 implies TLS) |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | SMTP credentials |

Use any authenticated relay reachable from GitHub-hosted runners, e.g. Azure
Communication Services Email SMTP or SendGrid. The report is always available in
the run's **job summary**, so delivery via email is optional.

## Inputs reference

| Input | Default | Meaning |
| --- | --- | --- |
| `areas` | `''` | Comma-separated Area labels |
| `owners` | `''` | Space/comma separated CODEOWNERS handles |
| `report_title` | `Triage Report` | Title and email subject prefix |
| `top_tasks` | `12` | Number of top tasks to list |
| `weeks` | `4` | Trailing weeks for the dynamics columns |

## Local dry run

Set `TRIAGE_FIXTURES` to a directory containing `open.json`, `created.json` and
`closed.json` (arrays of the GitHub issues/search API shape) to render the report
without calling the API. Set `WRITE_FILES=true` to also write
`triage-report.html` / `triage-report.txt`.
