const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { get } = require('../config/database');

async function getEmailConfig() {
  const provider = await get("SELECT value FROM email_settings WHERE key = 'email_provider'");
  const host = await get("SELECT value FROM email_settings WHERE key = 'smtp_host'");
  const port = await get("SELECT value FROM email_settings WHERE key = 'smtp_port'");
  const user = await get("SELECT value FROM email_settings WHERE key = 'smtp_user'");
  const pass = await get("SELECT value FROM email_settings WHERE key = 'smtp_pass'");
  const fromName = await get("SELECT value FROM email_settings WHERE key = 'from_name'");
  const sgKey = await get("SELECT value FROM email_settings WHERE key = 'sendgrid_api_key'");

  return {
    provider: provider ? provider.value : 'smtp',
    host: host ? host.value : null,
    port: port ? parseInt(port.value) : 587,
    user: user ? user.value : null,
    pass: pass ? pass.value : null,
    fromName: fromName ? fromName.value : 'SIMS School',
    sendgridApiKey: sgKey ? sgKey.value : null,
  };
}

async function isEmailConfigured() {
  const config = await getEmailConfig();
  if (config.provider === 'sendgrid') {
    return !!config.sendgridApiKey;
  }
  return !!(config.host && config.user && config.pass);
}

async function sendEmail(to, subject, html) {
  const config = await getEmailConfig();

  if (!await isEmailConfigured()) {
    console.error('[Email] Not configured. Cannot send email.');
    return false;
  }

  if (config.provider === 'sendgrid') {
    return sendViaSendGrid(to, subject, html, config);
  }

  return sendViaSMTP(to, subject, html, config);
}

async function sendViaSMTP(to, subject, html, config) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10000,
  });

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.user}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email][SMTP] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`[Email][SMTP] Failed to send to ${to}:`, error.message);
    return false;
  }
}

async function sendViaSendGrid(to, subject, html, config) {
  sgMail.setApiKey(config.sendgridApiKey);

  try {
    await sgMail.send({
      to,
      from: { email: config.user || 'noreply@sims.edu', name: config.fromName },
      subject,
      html,
    });
    console.log(`[Email][SendGrid] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`[Email][SendGrid] Failed to send to ${to}:`, error.response?.body || error.message);
    return false;
  }
}

module.exports = { getEmailConfig, isEmailConfigured, sendEmail };
