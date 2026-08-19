// Triage report generation (pure).
//
// buildReport(data, cfg) turns fetched issues into an HTML + text report and a
// small stats summary. It performs no I/O (no network, no filesystem, no email)
// so it can be unit-tested or dry-run with fixtures. All context it needs is
// passed in via cfg, so the same generator serves any team's scope.
//
//   data: { open, created, closed }  arrays of GitHub issue objects (REST shape)
//   cfg:  { owner, repo, reportTitle, topTasks, nweeks,
//           areaInputs, ownerInputs, ownedSet, now, date }
//
// Returns { text, html, stats: { total, sla, regressions, new7 } }.

function buildReport(data, cfg) {
  const { owner: OWNER, repo: REPO, reportTitle: REPORT_TITLE, topTasks: TOP_TASKS,
    nweeks: NWEEKS, areaInputs, ownerInputs, ownedSet, now, date } = cfg;
  const { open, created, closed } = data;

  // ---------- normalizers + scope ----------
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/v\d+$/, '');
  const normArea = s => s.toLowerCase().replace(/\s+/g, '');
  const areaSet = new Set(areaInputs.map(normArea));
  const days = iso => iso ? (now - new Date(iso).getTime()) / 86400000 : 9999;

  function shape(i) {
    const labelsRaw = (i.labels || []).map(l => l.name || l);
    return {
      n: i.number, title: i.title || '', body: i.body || '',
      labelsRaw,
      labels: labelsRaw.map(l => l.toLowerCase()),
      areaNorm: labelsRaw.map(normArea),
      assigned: (i.assignees || []).length > 0,
      comments: i.comments || 0,
      up: (i.reactions && i.reactions['+1']) || 0,
      ageC: days(i.created_at), ageU: days(i.updated_at),
      createdAgo: days(i.created_at), closedAgo: days(i.closed_at),
    };
  }

  const hasArea = i => i.areaNorm.some(a => areaSet.has(a));
  const taskKeys = i => i.labelsRaw.filter(l => /^task:/i.test(l)).map(l => norm(l.replace(/^task:\s*/i, '')));
  const ownerTask = i => taskKeys(i).some(t => ownedSet.has(t));
  const inScope = i => hasArea(i) || ownerTask(i);

  function typeOf(i) {
    const m = i.title.match(/^\s*\[([^\]]+)\]/);
    const tag = m ? m[1].toLowerCase().trim() : '';
    const has = x => i.labels.includes(x) || tag.includes(x);
    if (has('regression')) return 'regression';
    if (has('bug')) return 'bug';
    if (has('enhancement') || has('feature')) return 'enhancement';
    if (has('question')) return 'question';
    return 'untyped';
  }

  // ---------- helpers ----------
  const url = n => `https://github.com/${OWNER}/${REPO}/issues/${n}`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '\u2026' : s;

  // ---------- weekly bucketing ----------
  const weekOf = age => { if (age == null || age < 0) return 0; const w = Math.floor(age / 7) + 1; return w <= NWEEKS ? w : 0; };
  const weekOrder = []; for (let w = NWEEKS; w >= 1; w--) weekOrder.push(w);
  function weekLabel(w) {
    const end = new Date(now - (w - 1) * 7 * 86400000);
    const start = new Date(now - w * 7 * 86400000);
    const mmdd = d => d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return `${mmdd(start)}\u2013${mmdd(end)}`;
  }
  const weekLabels = weekOrder.map(weekLabel);

  const OPEN = open.map(shape);
  const OPENED = created.map(shape);
  const CLOSED = closed.map(shape);
  const S = OPEN.filter(inScope);

  function weekly(pred) {
    const o = {}, c = {};
    OPENED.filter(pred).forEach(i => { const w = weekOf(i.createdAgo); if (w) o[w] = (o[w] || 0) + 1; });
    CLOSED.filter(pred).forEach(i => { const w = weekOf(i.closedAgo); if (w) c[w] = (c[w] || 0) + 1; });
    return weekOrder.map(w => { const opened = o[w] || 0, closedN = c[w] || 0; return { opened, closed: closedN, net: opened - closedN }; });
  }

  const total = S.length;
  const unassigned = S.filter(i => !i.assigned).length;
  const pct = total ? Math.round(unassigned / total * 100) : 0;
  const stale30 = S.filter(i => i.ageU > 30).length;
  const AUTHOR_BLOCKED = ['need more info', 'need repro', 'waiting for author feedback', 'stale'];
  const sla = S.filter(i => i.labels.includes('triage') && !i.labels.some(x => AUTHOR_BLOCKED.includes(x)) && !i.assigned && i.ageC > 14).sort((a, b) => b.ageC - a.ageC);

  const bucketDefs = [];
  areaInputs.forEach(a => bucketDefs.push([a, i => i.areaNorm.includes(normArea(a))]));
  if (ownerInputs.length) {
    bucketDefs.push([`Owner tasks (${ownerInputs.join(', ')})`, i => ownerTask(i)]);
    bucketDefs.push(['\u2014 owner-task only (no listed area)', i => ownerTask(i) && !hasArea(i)]);
  }
  const breakdown = bucketDefs.map(([label, pred]) => ({ label, count: S.filter(pred).length, w: weekly(pred) }));

  const tcOpen = {};
  S.forEach(i => i.labelsRaw.filter(l => /^task:/i.test(l)).forEach(l => { const t = l.replace(/^task:\s*/i, 'Task: '); tcOpen[t] = (tcOpen[t] || 0) + 1; }));
  const taskPred = taskLabel => { const key = norm(taskLabel.replace(/^task:\s*/i, '')); return i => i.labelsRaw.some(l => /^task:/i.test(l) && norm(l.replace(/^task:\s*/i, '')) === key); };
  const topTasks = Object.entries(tcOpen).sort((a, b) => b[1] - a[1]).slice(0, TOP_TASKS).map(([t, c]) => ({ task: t, count: c, w: weekly(taskPred(t)) }));

  const TYPES = ['regression', 'bug', 'enhancement', 'question', 'untyped'];
  const typePred = type => i => inScope(i) && typeOf(i) === type;
  const typeDyn = TYPES.map(type => ({ type, open: S.filter(i => typeOf(i) === type).length, w: weekly(typePred(type)) }));

  const typeMix = {}; S.forEach(i => { const t = typeOf(i); typeMix[t] = (typeMix[t] || 0) + 1; });
  const regressions = S.filter(i => typeOf(i) === 'regression').sort((a, b) => b.ageC - a.ageC);
  const verRe = /breaking task version[^\n]*\n+\s*([^\n]+)[\s\S]*?last working task version[^\n]*\n+\s*([^\n]+)/i;
  const verPivot = i => { const m = i.body.match(verRe); return m ? { breaking: m[1].trim().slice(0, 24), lastWorking: m[2].trim().slice(0, 24) } : null; };
  const demand = S.filter(i => i.up > 0).sort((a, b) => b.up - a.up || b.comments - a.comments).slice(0, 10);
  const upvoted3 = S.filter(i => i.up >= 3).length;
  const noReply = S.filter(i => i.comments === 0).sort((a, b) => b.ageC - a.ageC);
  const cohorts = { '\u22647d': 0, '8\u201330d': 0, '31\u201390d': 0, '91\u2013365d': 0, '>1y': 0 };
  S.forEach(i => { const a = i.ageC; if (a <= 7) cohorts['\u22647d']++; else if (a <= 30) cohorts['8\u201330d']++; else if (a <= 90) cohorts['31\u201390d']++; else if (a <= 365) cohorts['91\u2013365d']++; else cohorts['>1y']++; });
  const new7 = S.filter(i => i.ageC <= 7);
  const new30 = S.filter(i => i.ageC <= 30).length;

  // ---- TEXT ----
  const cellTxt = d => { const net = d.net === 0 ? '\u00b10' : `${d.net > 0 ? '+' : ''}${d.net}`; return `${net}(${d.opened}/${d.closed})`.padStart(10); };
  const wkHdr = weekLabels.map(l => l.padStart(10)).join(' ');
  const t = [];
  t.push(`${REPORT_TITLE} \u2014 ${date}`);
  const scopeDesc = [areaInputs.length ? `Areas: ${areaInputs.join(', ')}` : '', ownerInputs.length ? `Owners: ${ownerInputs.join(', ')} (${ownedSet.size} tasks)` : ''].filter(Boolean).join(' | ');
  t.push(`Scope: ${scopeDesc}`);
  t.push(`In-scope open: ${total} | Unassigned: ${unassigned} (${pct}%) | Stale >30d: ${stale30} | SLA backlog: ${sla.length}`);
  t.push('');
  t.push('Weekly columns oldest->newest, cell = net(opened/closed):');
  t.push(`  cnt  ${'bucket'.padEnd(32)} ${wkHdr}`);
  t.push('Scope breakdown:');
  breakdown.forEach(b => t.push(`  ${String(b.count).padStart(3)}  ${b.label.padEnd(32)} ${b.w.map(cellTxt).join(' ')}`));
  t.push('');
  t.push('Top tasks in scope:');
  topTasks.forEach(x => t.push(`  ${String(x.count).padStart(3)}  ${x.task.padEnd(32)} ${x.w.map(cellTxt).join(' ')}`));
  t.push('');
  t.push('Type dynamics (in-scope):');
  typeDyn.forEach(x => t.push(`  ${String(x.open).padStart(3)}  ${x.type.padEnd(32)} ${x.w.map(cellTxt).join(' ')}`));
  t.push('');
  t.push(`[1] Type mix: ` + Object.entries(typeMix).map(([k, v]) => `${k} ${v}`).join(' | '));
  t.push(`    Open REGRESSIONS (${regressions.length}):`);
  regressions.forEach(r => { const v = verPivot(r); t.push(`      #${r.n}  ${Math.round(r.ageC)}d  ${clip(r.title, 58)}` + (v ? `  [${v.breaking} <- ${v.lastWorking}]` : '')); });
  t.push('');
  t.push(`[2] Community demand (${upvoted3} issues >=3 upvotes):`);
  demand.slice(0, 8).forEach(i => t.push(`      +${String(i.up).padStart(3)}  ${i.comments}c  #${i.n}  ${clip(i.title, 52)}`));
  t.push('');
  t.push(`[3] First-response gap - 0 comments (${noReply.length}):`);
  noReply.slice(0, 10).forEach(i => t.push(`      #${i.n}  ${Math.round(i.ageC)}d  ${clip(i.title, 58)}`));
  t.push('');
  t.push(`[4] Aging cohorts: ` + Object.entries(cohorts).map(([k, v]) => `${k}:${v}`).join('  '));
  t.push(`    Inflow: ${new7.length} opened last 7d, ${new30} last 30d`);
  const text = t.join('\n');

  // ---- HTML ----
  const th = 'style="text-align:left;padding:4px 10px;border-bottom:2px solid #ddd"';
  const thr = 'style="text-align:right;padding:4px 8px;border-bottom:2px solid #ddd;font-size:12px"';
  const td = 'style="padding:3px 10px;border-bottom:1px solid #eee"';
  const tdr = 'style="padding:3px 8px;border-bottom:1px solid #eee;text-align:right"';
  const cellHtml = d => {
    const color = d.net > 0 ? '#b00' : d.net < 0 ? '#080' : '#bbb';
    const netTxt = d.net === 0 ? '\u00b10' : `${d.net > 0 ? '+' : ''}${d.net}`;
    const sub = (d.opened || d.closed) ? `<div style="color:#999;font-size:10px;line-height:1">+${d.opened}/\u2212${d.closed}</div>` : '';
    return `<b style="color:${color}">${netTxt}</b>${sub}`;
  };
  const weekHead = weekLabels.map(l => `<th ${thr}>${l}</th>`).join('');
  const weekBody = w => w.map(d => `<td ${tdr}>${cellHtml(d)}</td>`).join('');
  let h = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222;max-width:900px">`;
  h += `<h2 style="margin:0 0 2px">${esc(REPORT_TITLE)}</h2><div style="color:#666;margin-bottom:4px">${date}</div>`;
  h += `<div style="color:#666;font-size:12px;margin-bottom:14px">Scope: ${esc(scopeDesc)}. Weekly columns oldest&rarr;newest; cell = <b>net</b> with <span style="color:#999">+opened/&minus;closed</span>. Red = net inflow, green = net cleared.</div>`;
  h += `<table style="border-collapse:collapse;margin-bottom:16px"><tr>`;
  [['In scope', total], ['Unassigned', `${unassigned} (${pct}%)`], ['Stale &gt;30d', stale30], ['SLA backlog', sla.length], ['New (7d)', new7.length]].forEach(([k, v]) =>
    h += `<td style="padding:8px 16px;border:1px solid #eee;background:#fafafa"><div style="font-size:20px;font-weight:600">${v}</div><div style="color:#777;font-size:12px">${k}</div></td>`);
  h += `</tr></table>`;
  h += `<h3>Scope breakdown <span style="font-weight:400;color:#777;font-size:12px">(last ${NWEEKS} weeks)</span></h3>`;
  h += `<table style="border-collapse:collapse"><tr><th ${th}>Bucket</th><th ${thr}>Open</th>${weekHead}</tr>`;
  breakdown.forEach(b => h += `<tr><td ${td}>${esc(b.label)}</td><td ${tdr}><b>${b.count}</b></td>${weekBody(b.w)}</tr>`);
  h += `</table>`;
  h += `<h3 style="margin-top:18px">Top tasks in scope <span style="font-weight:400;color:#777;font-size:12px">(last ${NWEEKS} weeks)</span></h3>`;
  h += `<table style="border-collapse:collapse"><tr><th ${th}>Task</th><th ${thr}>Open</th>${weekHead}</tr>`;
  topTasks.forEach(x => h += `<tr><td ${td}>${esc(x.task)}</td><td ${tdr}><b>${x.count}</b></td>${weekBody(x.w)}</tr>`);
  h += `</table>`;
  h += `<h3 style="margin-top:18px">Type dynamics <span style="font-weight:400;color:#777;font-size:12px">(in-scope, last ${NWEEKS} weeks)</span></h3>`;
  h += `<table style="border-collapse:collapse"><tr><th ${th}>Type</th><th ${thr}>Open</th>${weekHead}</tr>`;
  typeDyn.forEach(x => h += `<tr><td ${td}>${x.type}</td><td ${tdr}><b>${x.open}</b></td>${weekBody(x.w)}</tr>`);
  h += `</table>`;
  h += `<h3 style="margin-top:20px">1 &mdash; Type mix &amp; regression spotlight</h3>`;
  h += `<div style="margin-bottom:8px">` + Object.entries(typeMix).map(([k, v]) => `<span style="display:inline-block;margin-right:12px"><b>${v}</b> ${k}</span>`).join('') + `</div>`;
  h += `<div style="font-weight:600;color:#b00;margin:6px 0 4px">Open regressions (${regressions.length})</div>`;
  h += `<table style="border-collapse:collapse;width:100%"><tr><th ${th}>Issue</th><th ${thr}>Age</th><th ${th}>Title</th><th ${th}>Breaking &larr; Last working</th></tr>`;
  regressions.forEach(r => { const v = verPivot(r); h += `<tr><td ${td}><a href="${url(r.n)}">#${r.n}</a></td><td ${tdr}>${Math.round(r.ageC)}d</td><td ${td}>${esc(clip(r.title, 70))}</td><td ${td}>${v ? esc(v.breaking) + ' &larr; ' + esc(v.lastWorking) : '<span style="color:#bbb">&mdash;</span>'}</td></tr>`; });
  h += `</table>`;
  h += `<h3 style="margin-top:20px">2 &mdash; Community demand <span style="font-weight:400;color:#777;font-size:13px">(${upvoted3} issues &ge;3 upvotes)</span></h3>`;
  h += `<table style="border-collapse:collapse;width:100%"><tr><th ${thr}>&#128077;</th><th ${thr}>Comments</th><th ${th}>Issue</th><th ${th}>Title</th></tr>`;
  demand.forEach(i => h += `<tr><td ${tdr}><b>+${i.up}</b></td><td ${tdr}>${i.comments}</td><td ${td}><a href="${url(i.n)}">#${i.n}</a></td><td ${td}>${esc(clip(i.title, 64))}</td></tr>`);
  h += `</table>`;
  h += `<h3 style="margin-top:20px">3 &mdash; First-response gap <span style="font-weight:400;color:#777;font-size:13px">0 comments (${noReply.length})</span></h3>`;
  h += `<table style="border-collapse:collapse;width:100%"><tr><th ${th}>Issue</th><th ${thr}>Age</th><th ${th}>Title</th></tr>`;
  noReply.slice(0, 12).forEach(i => h += `<tr><td ${td}><a href="${url(i.n)}">#${i.n}</a></td><td ${tdr}>${Math.round(i.ageC)}d</td><td ${td}>${esc(clip(i.title, 74))}</td></tr>`);
  h += `</table>`;
  if (noReply.length > 12) h += `<div style="color:#777;font-size:12px;margin-top:4px">&hellip;and ${noReply.length - 12} more</div>`;
  h += `<h3 style="margin-top:20px">4 &mdash; Aging cohorts &amp; inflow</h3><table style="border-collapse:collapse;margin-bottom:8px"><tr>`;
  Object.entries(cohorts).forEach(([k, v]) => h += `<td style="padding:6px 14px;border:1px solid #eee;text-align:center"><div style="font-size:18px;font-weight:600">${v}</div><div style="color:#777;font-size:12px">${k}</div></td>`);
  h += `</tr></table><div><b>${new7.length}</b> opened last 7 days &middot; <b>${new30}</b> last 30 days</div>`;
  if (new7.length) { h += `<ul style="margin-top:2px">`; new7.forEach(i => h += `<li><a href="${url(i.n)}">#${i.n}</a> &mdash; ${esc(clip(i.title, 76))}</li>`); h += `</ul>`; }
  h += `</div>`;

  return { text, html: h, stats: { total, sla: sla.length, regressions: regressions.length, new7: new7.length } };
}

module.exports = { buildReport };
