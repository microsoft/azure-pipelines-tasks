// Email delivery for the triage report.
//
// Provider-agnostic SMTP send via nodemailer. Sending is best-effort and
// entirely optional: if MAIL_TO / SMTP_SERVER are not configured the report
// still renders to the Actions job summary, so callers can run before they
// have wired up mail secrets.
//
// Mail inputs (env / secrets):
//   MAIL_TO, MAIL_FROM, SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SECURE

async function sendMail(subject, html, text) {
  const to = process.env.MAIL_TO;
  const server = process.env.SMTP_SERVER;
  if (!to || !server) {
    console.log('SMTP not configured (need MAIL_TO + SMTP_SERVER) \u2014 skipping email; report is in the job summary.');
    return false;
  }
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch { console.log('nodemailer not installed \u2014 skipping email.'); return false; }
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const transport = nodemailer.createTransport({
    host: server, port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: process.env.SMTP_USERNAME ? { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USERNAME || to,
    to, subject, html, text,
  });
  console.log('Email sent to', to);
  return true;
}

module.exports = { sendMail };
