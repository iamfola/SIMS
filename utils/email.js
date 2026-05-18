const nodemailer = require('nodemailer');
const { get } = require('../config/database');

function getEmailConfig() {
  const host = get("SELECT value FROM email_settings WHERE key = 'smtp_host'");
  const port = get("SELECT value FROM email_settings WHERE key = 'smtp_port'");
  const user = get("SELECT value FROM email_settings WHERE key = 'smtp_user'");
  const pass = get("SELECT value FROM email_settings WHERE key = 'smtp_pass'");
  const fromName = get("SELECT value FROM email_settings WHERE key = 'from_name'");

  return {
    host: host ? host.value : null,
    port: port ? parseInt(port.value) : 587,
    user: user ? user.value : null,
    pass: pass ? pass.value : null,
    fromName: fromName ? fromName.value : 'SIMS School',
  };
}

function isEmailConfigured() {
  const config = getEmailConfig();
  return !!(config.host && config.user && config.pass);
}

async function sendEmail(to, subject, html) {
  const config = getEmailConfig();
  if (!config.host || !config.user || !config.pass) {
    console.error('[Email] SMTP not configured. Cannot send email.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.user}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error.message);
    return false;
  }
}

module.exports = { getEmailConfig, isEmailConfigured, sendEmail };
