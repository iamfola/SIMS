const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { get, getUserByUsername, getUserByRegNo, getUserById, validatePassword, updateUserPassword, getStudentByUserId, getTeacherByUserId, getUserWithEmail, getUserWithEmailByRegNo, createPasswordReset, getValidOTP, markOTPUsed, checkOTPLockout, recordFailedOTPAttempt, resetOTPLockout, generatePasscode, getSchoolSettings, recordFailedLogin, checkLoginLocked, resetFailedLogin } = require('../models/db');
const { isAuthenticated } = require('../middleware/auth');
const { isEmailConfigured, sendEmail } = require('../utils/email');

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: req.query.error, success: req.query.success, title: 'Login' });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let user = await getUserByUsername(username);

    if (!user) {
      user = await getUserByRegNo(username);
    }

    if (!user) {
      return res.render('login', { error: 'Invalid username or password', title: 'Login' });
    }

    const loginLock = await checkLoginLocked(user.id);
    if (loginLock.locked) {
      const mins = loginLock.remaining_minutes;
      return res.render('login', { error: `Account locked due to too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, title: 'Login' });
    }

    const otpLock = await checkOTPLockout(user.id);
    if (otpLock.locked) {
      if (otpLock.reason === 'permanent') {
        return res.render('login', { error: 'Account permanently locked due to multiple failed OTP attempts. Contact the admin to unlock.', title: 'Login' });
      }
      const until = new Date(otpLock.locked_until + 'Z').toLocaleString();
      return res.render('login', { error: `Account locked until ${until}.`, title: 'Login' });
    }

    const isValid = await validatePassword(user, password);
    if (!isValid) {
      const result = await recordFailedLogin(user.id);
      if (result.locked) {
        return res.render('login', { error: `Too many failed attempts. Account locked for 1 hour.`, title: 'Login' });
      }
      return res.render('login', { error: 'Invalid username or password', title: 'Login' });
    }

    await resetFailedLogin(user.id);

    if (user.role === 'student') {
      const student = await getStudentByUserId(user.id);
      if (!student) {
        return res.render('login', { error: 'Student record not found. Please contact admin.', title: 'Login' });
      }
    }

    if (user.role === 'teacher') {
      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) {
        return res.render('login', { error: 'Teacher record not found. Please contact admin.', title: 'Login' });
      }
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    if (user.must_change_password) {
      return res.redirect('/change-password');
    }

    if (user.role === 'student') {
      const student = await getStudentByUserId(user.id);
      if (student && (!student.email || student.email.trim() === '')) {
        return res.redirect('/student/setup-email');
      }
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'An error occurred during login', title: 'Login' });
  }
});

router.get('/change-password', isAuthenticated, (req, res) => {
  res.render('change-password', { mustChange: true, title: 'Change Password' });
});

router.post('/change-password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.render('change-password', { error: 'Passwords do not match', mustChange: true, title: 'Change Password' });
    }

    if (newPassword.length < 6) {
      return res.render('change-password', { error: 'Password must be at least 6 characters', mustChange: true, title: 'Change Password' });
    }

    const user = await getUserByUsername(req.session.username);

    if (!user.must_change_password) {
      const isValid = await validatePassword(user, currentPassword);
      if (!isValid) {
        return res.render('change-password', { error: 'Current password is incorrect', mustChange: false, title: 'Change Password' });
      }
    }

    await updateUserPassword(user.id, newPassword);

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Change password error:', error);
    res.render('change-password', { error: 'An error occurred', mustChange: true, title: 'Change Password' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.redirect('/login');
  });
});

router.get('/admin/verify-login', async (req, res) => {
  if (!req.session.pendingAdmin) {
    return res.redirect('/login');
  }
  const pending = req.session.pendingAdmin;
  const expired = Date.now() > pending.expiresAt;
  const maskedEmail = pending.email.replace(/(..).+(@.+)/, '$1***$2');

  res.render('admin/verify-login', {
    error: null,
    success: null,
    expired,
    maskedEmail,
    title: 'Admin Verification',
  });
});

router.post('/admin/verify-login', async (req, res) => {
  if (!req.session.pendingAdmin) {
    return res.redirect('/login');
  }
  const pending = req.session.pendingAdmin;
  const { code } = req.body;

  if (!code || !code.trim()) {
    return res.render('admin/verify-login', {
      error: 'Enter the verification code.',
      success: null,
      expired: false,
      maskedEmail: pending.email.replace(/(..).+(@.+)/, '$1***$2'),
      title: 'Admin Verification',
    });
  }

  if (Date.now() > pending.expiresAt) {
    delete req.session.pendingAdmin;
    return res.render('admin/verify-login', {
      error: 'Code expired. Please log in again.',
      success: null,
      expired: true,
      maskedEmail: '',
      title: 'Admin Verification',
    });
  }

  pending.attempts++;
  if (pending.attempts > 5) {
    delete req.session.pendingAdmin;
    return res.redirect('/login?error=Too many failed attempts. Please log in again.');
  }

  if (code.trim() !== pending.passcode) {
    const remaining = 5 - pending.attempts;
    return res.render('admin/verify-login', {
      error: `Invalid code. ${remaining} attempt(s) remaining.`,
      success: null,
      expired: false,
      maskedEmail: pending.email.replace(/(..).+(@.+)/, '$1***$2'),
      title: 'Admin Verification',
    });
  }

  const user = await getUserById(pending.userId);
  if (!user) {
    delete req.session.pendingAdmin;
    return res.redirect('/login?error=User not found.');
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  delete req.session.pendingAdmin;

  if (user.must_change_password) {
    return res.redirect('/change-password');
  }
  res.redirect('/dashboard');
});

router.get('/admin/resend-code', async (req, res) => {
  if (!req.session.pendingAdmin) {
    return res.redirect('/login');
  }
  const pending = req.session.pendingAdmin;
  const passcode = await generatePasscode();
  pending.passcode = passcode;
  pending.expiresAt = Date.now() + 10 * 60 * 1000;
  pending.attempts = 0;

  const school = await getSchoolSettings();
  const schoolName = school.school_name || 'SIMS';
  const subject = `Admin Verification Code - ${schoolName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Admin Login Verification (Resent)</h2>
      <p>Enter the following 6-word passcode to complete your login:</p>
      <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f0f4f8; border-radius: 12px;">
        <span style="font-size: 22px; font-weight: bold; color: #2c3e50; letter-spacing: 1px; word-break: break-all;">${passcode}</span>
      </div>
      <p>Each word is separated by a hyphen <strong>(-)</strong>. This code is valid for <strong>10 minutes</strong>.</p>
      <hr>
      <p style="color: #6c757d; font-size: 0.85rem;">This is an automated message from ${schoolName}.</p>
    </div>
  `;

  const sent = await sendEmail(pending.email, subject, html);
  const maskedEmail = pending.email.replace(/(..).+(@.+)/, '$1***$2');
  if (!sent) {
    return res.render('admin/verify-login', {
      error: 'Failed to resend code. Try again.',
      success: null,
      expired: false,
      maskedEmail,
      title: 'Admin Verification',
    });
  }

  res.render('admin/verify-login', {
    error: null,
    success: 'New code sent to your email.',
    expired: false,
    maskedEmail,
    title: 'Admin Verification',
  });
});

router.get('/forgot-password', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('forgot-password', { error: null, success: null, title: 'Forgot Password' });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.render('forgot-password', { error: 'Enter your username', success: null, title: 'Forgot Password' });
    }

    let user = await getUserWithEmail(username);
    if (!user) {
      user = await getUserWithEmailByRegNo(username);
    }
    if (!user) {
      return res.render('forgot-password', { error: 'Username or Reg No not found', success: null, title: 'Forgot Password' });
    }

    if (!user.email || user.email.trim() === '') {
      return res.render('forgot-password', {
        error: 'No email address on record. Please visit the admin to set up your email and try again.',
        success: null, title: 'Forgot Password'
      });
    }

    const lockStatus = await checkOTPLockout(user.id);
    if (lockStatus.locked) {
      if (lockStatus.reason === 'permanent') {
        return res.render('forgot-password', {
          error: 'Your account is permanently locked. Contact the admin to unlock.',
          success: null, title: 'Forgot Password'
        });
      }
      const until = new Date(lockStatus.locked_until + 'Z').toLocaleString();
      return res.render('forgot-password', {
        error: `Too many failed attempts. Your account is locked until ${until}.`,
        success: null, title: 'Forgot Password'
      });
    }

    if (!(await isEmailConfigured())) {
      return res.render('forgot-password', {
        error: 'Email system is not configured. Please contact the admin.',
        success: null, title: 'Forgot Password'
      });
    }

    const isAdmin = user.role === 'admin';
    const passcode = isAdmin ? await generatePasscode() : String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];

    await createPasswordReset(user.id, passcode, expiresAt);

    const school = await getSchoolSettings();
    const schoolName = school.school_name || 'SIMS';
    const subject = `Password Reset Code - ${schoolName}`;
    const codeDisplay = isAdmin ? passcode : passcode.split('').join(' ');
    const codeHint = isAdmin
      ? 'Each word is separated by a hyphen <strong>(-)</strong>.'
      : 'Enter the 6-digit code exactly as shown.';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Password Reset Request</h2>
        <p>Dear <strong>${user.username}</strong>,</p>
        <p>You requested to reset your password. Enter the code below to complete the process:</p>
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f0f4f8; border-radius: 12px;">
          <span style="font-size: ${isAdmin ? '22' : '32'}px; font-weight: bold; color: #2c3e50; letter-spacing: ${isAdmin ? '1' : '4'}px; word-break: break-all;">${codeDisplay}</span>
        </div>
        <p>${codeHint} This code is valid for <strong>30 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr>
        <p style="color: #6c757d; font-size: 0.85rem;">This is an automated message from ${schoolName}. Do not reply to this email.</p>
      </div>
    `;

    const sent = await sendEmail(user.email, subject, html);
    if (!sent) {
      return res.render('forgot-password', {
        error: 'Failed to send passcode email. Please try again later.',
        success: null, title: 'Forgot Password'
      });
    }

    req.session.pendingPasscodeReset = {
      userId: user.id,
      username: user.username,
      email: user.email,
      attempts: 0,
      codeType: isAdmin ? 'words' : 'digits',
    };
    res.redirect('/enter-passcode');
  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('forgot-password', { error: 'An error occurred. Please try again.', success: null, title: 'Forgot Password' });
  }
});

router.get('/enter-passcode', (req, res) => {
  if (!req.session.pendingPasscodeReset) {
    return res.redirect('/forgot-password');
  }
  const pending = req.session.pendingPasscodeReset;
  const maskedEmail = pending.email.replace(/(..).+(@.+)/, '$1***$2');

  res.render('enter-passcode', {
    error: null,
    success: null,
    expired: false,
    maskedEmail,
    codeType: pending.codeType || 'words',
    title: 'Enter Passcode',
  });
});

router.post('/enter-passcode', async (req, res) => {
  if (!req.session.pendingPasscodeReset) {
    return res.redirect('/forgot-password');
  }
  const pending = req.session.pendingPasscodeReset;
  const { code } = req.body;
  const maskedEmail = pending.email.replace(/(..).+(@.+)/, '$1***$2');

  if (!code || !code.trim()) {
    return res.render('enter-passcode', {
      error: 'Enter the passcode.',
      success: null,
      expired: false,
      maskedEmail,
      codeType: pending.codeType || 'words',
      title: 'Enter Passcode',
    });
  }

  pending.attempts++;
  if (pending.attempts > 5) {
    delete req.session.pendingPasscodeReset;
    return res.redirect('/forgot-password?error=Too many failed attempts. Request a new passcode.');
  }

  const user = await getUserById(pending.userId);
  if (!user) {
    delete req.session.pendingPasscodeReset;
    return res.redirect('/forgot-password?error=User not found.');
  }

  const validReset = await getValidOTP(user.id, code.trim());
  if (!validReset) {
    const result = await recordFailedOTPAttempt(user.id);
    if (result.locked) {
      delete req.session.pendingPasscodeReset;
      if (result.reason === 'permanent') {
        return res.redirect('/forgot-password?error=Account permanently locked. Contact admin.');
      }
      return res.redirect('/forgot-password?error=Account locked. Try again later.');
    }
    const remaining = 5 - pending.attempts;
    return res.render('enter-passcode', {
      error: `Invalid or expired passcode. ${remaining} attempt(s) remaining.`,
      success: null,
      expired: false,
      maskedEmail,
      codeType: pending.codeType || 'words',
      title: 'Enter Passcode',
    });
  }

  await resetOTPLockout(user.id);
  await markOTPUsed(validReset.id);
  const username = pending.username;
  const userId = user.id;
  delete req.session.pendingPasscodeReset;
  req.session.passcodeVerified = { userId, username };
  res.redirect('/reset-password?username=' + encodeURIComponent(username));
});

router.get('/resend-passcode', async (req, res) => {
  if (!req.session.pendingPasscodeReset) {
    return res.redirect('/forgot-password');
  }
  const pending = req.session.pendingPasscodeReset;

  const isWords = pending.codeType === 'words';
  const passcode = isWords ? await generatePasscode() : String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];
  await createPasswordReset(pending.userId, passcode, expiresAt);
  pending.attempts = 0;

  const school = await getSchoolSettings();
  const schoolName = school.school_name || 'SIMS';
  const subject = `Password Reset Code - ${schoolName}`;
  const codeDisplay = isWords ? passcode : passcode.split('').join(' ');
  const codeHint = isWords
    ? 'Each word is separated by a hyphen <strong>(-)</strong>.'
    : 'Enter the 6-digit code exactly as shown.';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Password Reset Code (Resent)</h2>
      <p>Enter the following code to reset your password:</p>
      <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f0f4f8; border-radius: 12px;">
        <span style="font-size: ${isWords ? '22' : '32'}px; font-weight: bold; color: #2c3e50; letter-spacing: ${isWords ? '1' : '4'}px; word-break: break-all;">${codeDisplay}</span>
      </div>
      <p>${codeHint} This code is valid for <strong>30 minutes</strong>.</p>
      <hr>
      <p style="color: #6c757d; font-size: 0.85rem;">This is an automated message from ${schoolName}. Do not reply to this email.</p>
    </div>
  `;

  const sent = await sendEmail(pending.email, subject, html);
  const maskedEmail = pending.email.replace(/(..).+(@.+)/, '$1***$2');
  if (!sent) {
    return res.render('enter-passcode', {
      error: 'Failed to resend code. Try again.',
      success: null,
      expired: false,
      maskedEmail,
      codeType: pending.codeType || 'words',
      title: 'Enter Passcode',
    });
  }

  res.render('enter-passcode', {
    error: null,
    success: 'New code sent to your email.',
    expired: false,
    maskedEmail,
    codeType: pending.codeType || 'words',
    title: 'Enter Passcode',
  });
});

router.get('/reset-password', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  const { username } = req.query;
  if (!username) {
    return res.redirect('/forgot-password');
  }
  if (!req.session.passcodeVerified || req.session.passcodeVerified.username !== username) {
    return res.redirect('/forgot-password');
  }
  res.render('reset-password', { username, error: null, title: 'Reset Password' });
});

router.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword, confirmPassword } = req.body;

    if (!username || !newPassword || !confirmPassword) {
      return res.render('reset-password', { username, error: 'All fields are required', title: 'Reset Password' });
    }

    if (newPassword !== confirmPassword) {
      return res.render('reset-password', { username, error: 'Passwords do not match', title: 'Reset Password' });
    }

    if (newPassword.length < 6) {
      return res.render('reset-password', { username, error: 'Password must be at least 6 characters', title: 'Reset Password' });
    }

    if (!req.session.passcodeVerified || req.session.passcodeVerified.username !== username) {
      return res.redirect('/forgot-password');
    }

    let user = await getUserByUsername(username);
    if (!user) {
      user = await getUserByRegNo(username);
    }
    if (!user) {
      return res.render('reset-password', { username, error: 'User not found', title: 'Reset Password' });
    }

    const lockStatus = await checkOTPLockout(user.id);
    if (lockStatus.locked) {
      if (lockStatus.reason === 'permanent') {
        return res.render('reset-password', {
          username, error: 'Account permanently locked. Contact the admin to unlock.', title: 'Reset Password'
        });
      }
      const until = new Date(lockStatus.locked_until + 'Z').toLocaleString();
      return res.render('reset-password', {
        username, error: `Account locked until ${until}.`, title: 'Reset Password'
      });
    }

    await resetOTPLockout(user.id);
    await updateUserPassword(user.id, newPassword);

    delete req.session.passcodeVerified;
    res.redirect('/login?success=Password reset successful. You must change your password on next login.');
  } catch (error) {
    console.error('Reset password error:', error);
    res.render('reset-password', { username: req.body.username, error: 'An error occurred. Please try again.', title: 'Reset Password' });
  }
});

module.exports = router;
