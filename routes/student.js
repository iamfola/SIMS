const express = require('express');
const router = express.Router();
const {
  getStudentByUserId, getStudentSubjects, getStudentAttendance,
  getStudentResults, getPendingResultCount, getGradingSystem,
  getCurrentSession, getCurrentTerm, get, query, getStudentById,
  updateStudentEmail, sendResultPdfEmail,
} = require('../models/db');
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
