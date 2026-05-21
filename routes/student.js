const express = require('express');
const router = express.Router();
const path = require('path');
const {
  getStudentByUserId, getStudentSubjects, getStudentAttendance,
  getStudentResults, getPendingResultCount, getGradingSystem,
  getCurrentSession, getCurrentTerm, get, query, getStudentById,
  updateStudentEmail, sendResultPdfEmail,
} = require('../models/db');
const { generateResultPdf } = require('../utils/resultPdf');
const { isStudent } = require('../middleware/auth');

router.get('/setup-email', isStudent, async (req, res) => {
  const student = await getStudentByUserId(req.session.userId);
  res.render('student/setup-email', { student, title: 'Set Up Email', error: req.query.error, success: req.query.success });
});

router.post('/setup-email', isStudent, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.redirect('/student/setup-email?error=Please enter a valid email address');
    }
    const student = await getStudentByUserId(req.session.userId);
    await updateStudentEmail(student.id, email);
    res.redirect('/student/dashboard?success=Email saved successfully');
  } catch (error) {
    console.error('Setup email error:', error);
    res.redirect('/student/setup-email?error=Failed to save email');
  }
});

router.get('/dashboard', isStudent, async (req, res) => {
  const db = require('../config/database');
  const student = await getStudentByUserId(req.session.userId);
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();

  if (!student) {
    return res.status(404).render('error', { message: 'Student record not found. Please contact admin.' });
  }

  const sessionId = currentSession ? currentSession.id : null;
  const termId = currentTerm ? currentTerm.id : null;
  const subjects = await getStudentSubjects(student.class_id);

  const totalAttendance = (await db.get('SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND session_id = ? AND term_id = ?', [student.id, sessionId, termId])).count;
  const presentCount = (await db.get("SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = 'present' AND session_id = ? AND term_id = ?", [student.id, sessionId, termId])).count;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const approvedResults = (await db.get("SELECT COUNT(*) as count FROM results WHERE student_id = ? AND status = 'approved' AND session_id = ? AND term_id = ?", [student.id, sessionId, termId])).count;

  res.render('student/dashboard', {
    student,
    subjects,
    attendanceRate,
    approvedResults,
    currentSession,
    currentTerm,
    success: req.query.success,
    title: 'Student Dashboard'
  });
});

router.get('/profile', isStudent, async (req, res) => {
  const student = await getStudentByUserId(req.session.userId);
  if (!student) {
    return res.status(404).render('error', { message: 'Student record not found. Please contact admin.' });
  }
  const subjects = await getStudentSubjects(student.class_id);
  res.render('student/profile', { student, subjects, title: 'My Profile' });
});

router.get('/subjects', isStudent, async (req, res) => {
  const student = await getStudentByUserId(req.session.userId);
  if (!student) {
    return res.status(404).render('error', { message: 'Student record not found. Please contact admin.' });
  }
  const subjects = await getStudentSubjects(student.class_id);
  res.render('student/subjects', { subjects, title: 'My Subjects' });
});

router.get('/attendance', isStudent, async (req, res) => {
  const student = await getStudentByUserId(req.session.userId);
  if (!student) {
    return res.status(404).render('error', { message: 'Student record not found. Please contact admin.' });
  }
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();
  const sessionId = currentSession ? currentSession.id : null;
  const termId = currentTerm ? currentTerm.id : null;
  let attendance = [];
  if (sessionId && termId) {
    attendance = await query(`
      SELECT a.*, u.username as marked_by_name
      FROM attendance a
      JOIN teachers t ON a.marked_by = t.id
      JOIN users u ON t.user_id = u.id
      WHERE a.student_id = ? AND a.session_id = ? AND a.term_id = ?
      ORDER BY a.date DESC
    `, [student.id, sessionId, termId]);
  }

  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  res.render('student/attendance', {
    attendance,
    stats: { total, present, absent, late, rate },
    currentSession,
    currentTerm,
    title: 'My Attendance'
  });
});

router.get('/results', isStudent, async (req, res) => {
  const student = await getStudentByUserId(req.session.userId);
  if (!student) {
    return res.status(404).render('error', { message: 'Student record not found. Please contact admin.' });
  }
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();
  const { session_id, term_id } = req.query;

  let sessionId = currentSession ? currentSession.id : null;
  let termId = currentTerm ? currentTerm.id : null;

  if (session_id) sessionId = parseInt(session_id);
  if (term_id) termId = parseInt(term_id);

  const allSessions = await query('SELECT * FROM sessions ORDER BY name DESC');
  let availableTerms = [];
  if (sessionId) {
    availableTerms = await query('SELECT * FROM terms WHERE session_id = ? ORDER BY name ASC', [sessionId]);
  }

  const selectedSession = sessionId ? await get('SELECT * FROM sessions WHERE id = ?', [sessionId]) : null;
  const selectedTerm = termId ? await get('SELECT * FROM terms WHERE id = ?', [termId]) : null;

  const results = await getStudentResults(student.id, sessionId || null, termId || null);
  const pendingCount = await getPendingResultCount(student.id, sessionId || null, termId || null);

  res.render('student/results', {
    results, pendingCount,
    currentSession, currentTerm,
    allSessions, availableTerms,
    selectedSessionId: sessionId, selectedTermId: termId,
    selectedSession, selectedTerm,
    title: 'My Results'
  });
});

router.get('/results/download', isStudent, async (req, res) => {
  try {
    const student = await getStudentByUserId(req.session.userId);
    if (!student) {
      return res.status(404).render('error', { message: 'Student not found' });
    }

    const { session_id, term_id } = req.query;
    let sid = session_id ? parseInt(session_id) : null;
    let tid = term_id ? parseInt(term_id) : null;

    if (!sid) {
      const cs = await getCurrentSession();
      sid = cs ? cs.id : null;
    }
    if (!tid) {
      const ct = await getCurrentTerm();
      tid = ct ? ct.id : null;
    }

    if (!sid || !tid) {
      return res.redirect('/student/results?error=Select a session and term to download');
    }

    const session = await get('SELECT * FROM sessions WHERE id = ?', [sid]);
    const term = await get('SELECT * FROM terms WHERE id = ?', [tid]);
    if (!session || !term) {
      return res.redirect('/student/results?error=Session or term not found');
    }

    const results = await query(`
      SELECT r.*, sub.name as subject_name
      FROM results r
      JOIN subjects sub ON r.subject_id = sub.id
      WHERE r.student_id = ? AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?))) AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?))) AND r.status = 'approved'
      ORDER BY sub.name
    `, [student.id, sid, sid, tid, tid]);

    if (results.length === 0) {
      return res.redirect('/student/results?error=No approved results found for this session and term');
    }

    const totalScore = results.reduce((sum, r) => sum + r.total, 0);
    const avgScore = results.length > 0 ? (totalScore / results.length).toFixed(2) : 0;

    const grades = await getGradingSystem();

    const db = require('../config/database');
    const totalAttendance = (await db.get('SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND session_id = ? AND term_id = ?', [student.id, sid, tid])).count;
    const presentCount = (await db.get("SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = 'present' AND session_id = ? AND term_id = ?", [student.id, sid, tid])).count;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    const classRankData = await query(`
      SELECT s.id, SUM(r.total) as total_score
      FROM students s
      JOIN results r ON s.id = r.student_id
      JOIN subjects sub ON r.subject_id = sub.id
      WHERE s.class_id = ? AND r.status = 'approved' AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?))) AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?)))
      GROUP BY s.id
      ORDER BY total_score DESC
    `, [student.class_id, sid, sid, tid, tid]);

    let classPosition = 0;
    for (let i = 0; i < classRankData.length; i++) {
      if (classRankData[i].id == student.id) {
        classPosition = i + 1;
        break;
      }
    }

    const school = await require('../models/db').getSchoolSettings();
    const crypto = require('crypto');
    const shortName = school.school_short_name || 'SIMS';

    let verificationCode;
    let codeExists = true;
    while (codeExists) {
      const num = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
      verificationCode = `${shortName}-${new Date().getFullYear()}-${num}`;
      codeExists = !!(await get('SELECT id FROM verifications WHERE code = ?', [verificationCode]));
    }

    const hash = crypto.createHash('sha256').update(results.map(r => `${r.subject_id}:${r.ca_score}:${r.exam_score}:${r.total}:${r.grade}`).join('|')).digest('hex');
    await require('../models/db').run('INSERT INTO verifications (code, student_id, session_id, term_id, results_hash) VALUES (?, ?, ?, ?, ?)',
      [verificationCode, student.id, sid, tid, hash]);

    const pdfBuffer = await generateResultPdf(student, session, term, results, grades, avgScore, attendanceRate, classPosition, classRankData.length, verificationCode, school);

    const fileName = `${student.reg_no}_${term.name.replace(/\s+/g, '_')}_${session.name.replace('/', '_')}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download result PDF error:', error);
    res.redirect('/student/results?error=Failed to generate PDF');
  }
});

router.post('/request-result', isStudent, async (req, res) => {
  try {
    const student = await getStudentByUserId(req.session.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { session_id, term_id } = req.body;
    if (!session_id || !term_id) {
      return res.json({ success: false, message: 'Select a session and term first' });
    }

    const result = await sendResultPdfEmail(student.id, parseInt(session_id), parseInt(term_id));
    res.json(result);
  } catch (error) {
    console.error('Request result error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
