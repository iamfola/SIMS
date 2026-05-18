const express = require('express');
const router = express.Router();
const {
  getTeacherByUserId, getTeacherAssignedSubjects, getStudentsByClassId,
  calculateGrade, upsertResult, getResultsForTeacher, getClassSubjectById,
  upsertAttendance, getStudentByUserId, getStudentById,
  getStudentSubjects, get, query,
  getCurrentSession, getCurrentTerm, getTodayAttendanceForClass, getAttendanceDatesForClass, getAttendanceForDate,
  sendAttendanceNotification,
} = require('../models/db');
const { isTeacher } = require('../middleware/auth');

router.get('/dashboard', isTeacher, (req, res) => {
  const db = require('../config/database');
  const teacher = getTeacherByUserId(req.session.userId);
  const student = getStudentByUserId(req.session.userId);
  const assignedSubjects = getTeacherAssignedSubjects(teacher.id);
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();

  let classStudents = [];
  if (teacher.class_id) {
    classStudents = getStudentsByClassId(teacher.class_id);
  }

  const today = new Date().toISOString().split('T')[0];
  const sessionId = currentSession ? currentSession.id : null;
  const termId = currentTerm ? currentTerm.id : null;
  const attendanceToday = db.get('SELECT COUNT(*) as count FROM attendance WHERE marked_by = ? AND date = ? AND session_id = ? AND term_id = ?', [teacher.id, today, sessionId, termId]).count;
  const pendingResults = getResultsForTeacher(teacher.id, sessionId, termId).filter(r => r.status === 'pending').length;

  res.render('teacher/dashboard', {
    teacher, student, assignedSubjects, attendanceToday, pendingResults, classStudents, currentSession, currentTerm, title: 'Teacher Dashboard'
  });
});

router.get('/students', isTeacher, (req, res) => {
  const teacher = getTeacherByUserId(req.session.userId);
  let students = [];
  if (teacher.class_id) {
    students = getStudentsByClassId(teacher.class_id);
  }
  res.render('teacher/students', { students, teacher, title: 'My Students' });
});

router.get('/enter-results', isTeacher, (req, res) => {
  const teacher = getTeacherByUserId(req.session.userId);
  const assignedSubjects = getTeacherAssignedSubjects(teacher.id);
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();
  let students = [];
  if (teacher.class_id) {
    students = getStudentsByClassId(teacher.class_id);
  }

  const studentId = req.query.student;
  let selectedStudent = null;
  let studentSubjects = [];
  let studentResults = {};

   if (studentId) {
    selectedStudent = getStudentById(studentId);
    if (selectedStudent && selectedStudent.class_id === teacher.class_id) {
      studentSubjects = getStudentSubjects(selectedStudent.class_id);
      
      let results = [];
      if (currentSession && currentTerm) {
        results = query(`
          SELECT * FROM results WHERE student_id = ?
          AND (session_id = ? OR (session_id IS NULL AND session = (SELECT name FROM sessions WHERE id = ?)))
          AND (term_id = ? OR (term_id IS NULL AND term = (SELECT name FROM terms WHERE id = ?)))
        `, [studentId, currentSession.id, currentSession.id, currentTerm.id, currentTerm.id]);
      }
      
      results.forEach(r => {
        studentResults[r.subject_id] = r;
      });
    }
  }

  res.render('teacher/enter-results', {
    assignedSubjects, students, teacher, selectedStudent, studentSubjects, studentResults, currentSession, currentTerm, title: 'Enter Results'
  });
});

router.post('/results', isTeacher, async (req, res) => {
  try {
    const { student_id } = req.body;
    const teacher = getTeacherByUserId(req.session.userId);
    const student = getStudentById(student_id);
    const currentSession = getCurrentSession();
    const currentTerm = getCurrentTerm();

    if (!student || student.class_id !== teacher.class_id) {
      return res.redirect('/teacher/enter-results?error=Invalid student or not in your class');
    }

    if (!currentSession || !currentTerm) {
      return res.redirect('/teacher/enter-results?error=No active session or term set. Contact admin.');
    }

    const studentSubjects = getStudentSubjects(student.class_id);
    let uploadedCount = 0;
    let skippedCount = 0;

    for (const ss of studentSubjects) {
      const existingResult = get(`
        SELECT id, status FROM results WHERE student_id = ? AND subject_id = ?
        AND (session_id = ? OR (session_id IS NULL AND session = (SELECT name FROM sessions WHERE id = ?)))
        AND (term_id = ? OR (term_id IS NULL AND term = (SELECT name FROM terms WHERE id = ?)))
      `, [student_id, ss.subject_id, currentSession.id, currentSession.id, currentTerm.id, currentTerm.id]);

      if (existingResult && existingResult.status !== 'rejected') {
        skippedCount++;
        continue;
      }

      const caInput = req.body[`ca_${ss.subject_id}`];
      const examInput = req.body[`exam_${ss.subject_id}`];

      if (caInput === undefined || caInput === '' || examInput === undefined || examInput === '') {
        skippedCount++;
        continue;
      }

      const ca = Math.round(parseFloat(caInput));
      const exam = Math.round(parseFloat(examInput));
      const total = ca + exam;
      const grade = calculateGrade(total);

      upsertResult(student_id, ss.subject_id, ca, exam, total, grade, 'pending', currentTerm.name, currentSession.name, currentSession.id, currentTerm.id);
      uploadedCount++;
    }

    let message = `Results uploaded: ${uploadedCount} new, ${skippedCount} skipped. Pending admin approval.`;
    res.redirect(`/teacher/results?success=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error('Upload results error:', error);
    res.redirect('/teacher/enter-results?error=Failed to upload results');
  }
});

router.get('/results', isTeacher, (req, res) => {
  const teacher = getTeacherByUserId(req.session.userId);
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();
  const sessionId = currentSession ? currentSession.id : null;
  const termId = currentTerm ? currentTerm.id : null;
  const results = getResultsForTeacher(teacher.id, sessionId, termId);
  const grouped = {};
  results.forEach(r => {
    const key = r.student_id;
    if (!grouped[key]) {
      grouped[key] = {
        student_id: r.student_id,
        reg_no: r.reg_no,
        first_name: r.first_name,
        middle_name: r.middle_name,
        last_name: r.last_name,
        class_name: r.class_name,
        class_arm: r.class_arm,
        subjects: [],
      };
    }
    grouped[key].subjects.push(r);
  });
  const groupedResults = Object.values(grouped);
  res.render('teacher/results', { results: groupedResults, success: req.query.success, teacher, currentSession, currentTerm, title: 'My Results' });
});

router.get('/attendance', isTeacher, (req, res) => {
  const teacher = getTeacherByUserId(req.session.userId);
  const classSubjects = getTeacherAssignedSubjects(teacher.id);
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();
  const today = new Date().toISOString().split('T')[0];
  let students = [];
  let todayAttendance = {};

  if (teacher.class_id) {
    students = getStudentsByClassId(teacher.class_id);
    const attendanceRecords = getTodayAttendanceForClass(teacher.class_id, today);
    attendanceRecords.forEach(r => {
      todayAttendance[r.student_id] = r.status;
    });
  }

  const markedCount = Object.keys(todayAttendance).length;
  const presentCount = Object.values(todayAttendance).filter(s => s === 'present').length;
  const lateCount = Object.values(todayAttendance).filter(s => s === 'late').length;
  const absentCount = Object.values(todayAttendance).filter(s => s === 'absent').length;

  res.render('teacher/attendance', { classSubjects, students, teacher, currentSession, currentTerm, today, todayAttendance, markedCount, presentCount, lateCount, absentCount, success: req.query.success, error: req.query.error, title: 'Mark Attendance' });
});

router.post('/attendance', isTeacher, (req, res) => {
  try {
    const { class_id, date, attendance } = req.body;
    const teacher = getTeacherByUserId(req.session.userId);
    const currentSession = getCurrentSession();
    const currentTerm = getCurrentTerm();

    const parsedAttendance = JSON.parse(attendance);

    if (teacher.class_id && parseInt(class_id) !== teacher.class_id) {
      return res.redirect('/teacher/attendance?error=You can only mark attendance for your assigned class');
    }

    if (!currentSession || !currentTerm) {
      return res.redirect('/teacher/attendance?error=No active session or term set. Contact admin.');
    }

    for (const a of parsedAttendance) {
      upsertAttendance(a.student_id, date, a.status, teacher.id, currentSession.id, currentTerm.id);
      sendAttendanceNotification(a.student_id, a.status, date, currentTerm.name, currentSession.name);
    }
    res.redirect('/teacher/attendance?success=Attendance marked successfully');
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.redirect('/teacher/attendance?error=Failed to mark attendance');
  }
});

router.get('/attendance-history', isTeacher, (req, res) => {
  const teacher = getTeacherByUserId(req.session.userId);
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();
  const selectedDate = req.query.date || null;

  let dates = [];
  let dayAttendance = [];
  let dayPresent = 0, dayAbsent = 0, dayLate = 0;

  if (teacher.class_id) {
    dates = getAttendanceDatesForClass(teacher.class_id);

    if (selectedDate) {
      dayAttendance = getAttendanceForDate(teacher.class_id, selectedDate);
      dayPresent = dayAttendance.filter(r => r.status === 'present').length;
      dayAbsent = dayAttendance.filter(r => r.status === 'absent').length;
      dayLate = dayAttendance.filter(r => r.status === 'late').length;
    }
  }

  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  res.render('teacher/attendance-history', {
    dates, dayAttendance, teacher, currentSession, currentTerm,
    selectedDate, formattedDate, dayPresent, dayAbsent, dayLate,
    title: 'Attendance History'
  });
});

module.exports = router;
