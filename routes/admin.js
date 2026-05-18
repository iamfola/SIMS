const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const {
  getAllClasses, createClass, deleteClass,
  getAllSubjects, createSubject, getClassSubjects, assignClassSubject,
  getAllTeachers, createUser, createTeacher, deleteTeacher,
  getAllStudents, createStudent, generateRegNo, deleteStudent, updateStudent, updateTeacher,
  getGradingSystem, addGrade, deleteGrade,
  getAllResults, approveResult, rejectResult,
  getAllAttendance, getUserByUsername,
  getAttendanceDatesForClass, getAttendanceForDate,
  createStudentWithUser, createTeacherWithUser,
  updateTeacherClass,
  get, run, calculateGrade, query,
  getStudentsByClassId, getStudentById,
  getCurrentSession, getCurrentTerm, getAllSessions, createSession, deleteSession, setActiveSession,
  getTermsBySession, createTerm, deleteTerm, setActiveTerm,
  promoteStudents, resetUserPassword,
  getPendingResults,
  setEmailSetting, getEmailSetting,
  sendResultApprovalEmail, sendResultEditEmail, sendNewsletter, verifyCode,
  getLockedUsers, adminUnlockOTP,
  getSchoolSettings, updateSchoolSetting,
} = require('../models/db');
const { isAdmin } = require('../middleware/auth');

router.get('/dashboard', isAdmin, (req, res) => {
  const db = require('../config/database');
  const studentCount = db.get('SELECT COUNT(*) as count FROM students').count;
  const teacherCount = db.get('SELECT COUNT(*) as count FROM teachers').count;
  const classCount = db.get('SELECT COUNT(*) as count FROM classes').count;
  const pendingResults = getPendingResults().length;
  const lockedCount = db.get('SELECT COUNT(*) as count FROM otp_lockouts WHERE lock_level > 0').count;

  res.render('admin/dashboard', {
    studentCount, teacherCount, classCount, pendingResults, lockedCount,
    title: 'Admin Dashboard'
  });
});

router.put('/teachers/:id', isAdmin, async (req, res) => {
  try {
    const { first_name, middle_name, last_name, class_id } = req.body;
    const existingTeacher = get('SELECT id FROM teachers WHERE id = ?', [req.params.id]);
    if (!existingTeacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    updateTeacher(parseInt(req.params.id), first_name, middle_name, last_name, class_id || null);
    res.json({ success: true });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ success: false, error: 'Failed to update teacher' });
  }
});

router.post('/teachers/:id/reset-password', isAdmin, async (req, res) => {
  try {
    const teacher = get('SELECT user_id FROM teachers WHERE id = ?', [req.params.id]);
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    await resetUserPassword(teacher.user_id);
    res.json({ success: true, message: 'Password reset to 12345678. Teacher must change on next login.' });
  } catch (error) {
    console.error('Reset teacher password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

router.get('/sessions', isAdmin, (req, res) => {
  const sessions = getAllSessions();
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();
  const terms = currentSession ? getTermsBySession(currentSession.id) : [];

  res.render('admin/sessions', {
    sessions, currentSession, currentTerm, terms,
    success: req.query.success,
    error: req.query.error,
    title: 'Academic Sessions'
  });
});

router.post('/sessions', isAdmin, (req, res) => {
  try {
    const { name } = req.body;
    createSession(name);
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Create session error:', error);
    res.redirect('/admin/sessions?error=Failed to create session');
  }
});

router.post('/sessions/:id/activate', isAdmin, (req, res) => {
  try {
    setActiveSession(parseInt(req.params.id));
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Activate session error:', error);
    res.redirect('/admin/sessions?error=Failed to activate session');
  }
});

router.post('/sessions/switch', isAdmin, (req, res) => {
  try {
    const { session_id, promote } = req.body;
    console.log(`[Session Switch] session_id=${session_id}, promote=${promote}`);
    setActiveSession(parseInt(session_id));
    let promotionResult = null;
    if (promote === 'on' || promote === 'true' || promote === '1') {
      console.log('[Session Switch] Promotion enabled, running promoteStudents()');
      promotionResult = promoteStudents();
    }
    const redirectUrl = promotionResult
      ? `/admin/sessions?success=Session switched. Promoted: ${promotionResult.promotedCount}, Skipped: ${promotionResult.noPromotionCount}`
      : '/admin/sessions?success=Session switched successfully';
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Switch session error:', error);
    res.redirect('/admin/sessions?error=Failed to switch session');
  }
});

router.delete('/sessions/:id', isAdmin, (req, res) => {
  try {
    const result = deleteSession(parseInt(req.params.id));
    if (result === null) {
      return res.status(400).json({ success: false, error: 'Cannot delete active session' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

router.post('/terms', isAdmin, (req, res) => {
  try {
    const { name, session_id } = req.body;
    createTerm(name, parseInt(session_id));
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Create term error:', error);
    res.redirect('/admin/sessions?error=Failed to create term');
  }
});

router.post('/terms/:id/activate', isAdmin, (req, res) => {
  try {
    setActiveTerm(parseInt(req.params.id));
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Activate term error:', error);
    res.redirect('/admin/sessions?error=Failed to activate term');
  }
});

router.delete('/terms/:id', isAdmin, (req, res) => {
  try {
    const result = deleteTerm(parseInt(req.params.id));
    if (result === null) {
      return res.status(400).json({ success: false, error: 'Cannot delete active term' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete term' });
  }
});

router.get('/classes', isAdmin, (req, res) => {
  const classes = getAllClasses();
  res.render('admin/classes', { classes, title: 'Manage Classes' });
});

router.post('/classes', isAdmin, (req, res) => {
  try {
    const { name, arm } = req.body;
    createClass(name, arm);
    res.redirect('/admin/classes');
  } catch (error) {
    console.error('Create class error:', error);
    res.redirect('/admin/classes?error=Failed to create class');
  }
});

router.delete('/classes/:id', isAdmin, (req, res) => {
  try {
    deleteClass(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete class' });
  }
});

router.get('/subjects', isAdmin, (req, res) => {
  const subjects = getAllSubjects();
  const classes = getAllClasses();
  const classSubjects = getClassSubjects();
  const teachers = getAllTeachers();

  // Group subjects by class
  const groupedSubjects = {};
  classSubjects.forEach(cs => {
    const key = `${cs.class_name} ${cs.class_arm}`;
    if (!groupedSubjects[key]) {
      groupedSubjects[key] = {
        class_name: cs.class_name,
        class_arm: cs.class_arm,
        subjects: []
      };
    }
    groupedSubjects[key].subjects.push(cs);
  });

  const groupedClasses = Object.values(groupedSubjects);

  res.render('admin/subjects', { subjects, classes, groupedClasses, teachers, title: 'Manage Subjects' });
});

router.post('/subjects', isAdmin, (req, res) => {
  try {
    const { name } = req.body;
    createSubject(name);
    res.redirect('/admin/subjects');
  } catch (error) {
    console.error('Create subject error:', error);
    res.redirect('/admin/subjects?error=Failed to create subject');
  }
});

router.post('/class-subjects', isAdmin, (req, res) => {
  try {
    const { class_id, subject_id, teacher_id } = req.body;
    assignClassSubject(class_id, subject_id, teacher_id || null);
    res.redirect('/admin/subjects');
  } catch (error) {
    console.error('Assign subject error:', error);
    res.redirect('/admin/subjects?error=Failed to assign subject');
  }
});

router.delete('/class-subjects/:id', isAdmin, (req, res) => {
  try {
    run('DELETE FROM class_subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete class subject error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete assignment' });
  }
});

router.put('/class-subjects/:id', isAdmin, (req, res) => {
  try {
    const { teacher_id } = req.body;
    run('UPDATE class_subjects SET teacher_id = ? WHERE id = ?', [teacher_id || null, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Update class subject error:', error);
    res.status(500).json({ success: false, error: 'Failed to update assignment' });
  }
});

router.get('/teachers', isAdmin, (req, res) => {
  const teachers = getAllTeachers();
  const classes = getAllClasses();
  res.render('admin/teachers', { teachers, classes, title: 'Manage Teachers' });
});

router.post('/teachers', isAdmin, async (req, res) => {
  try {
    const { username, password, first_name, middle_name, last_name, class_id } = req.body;

    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return res.redirect('/admin/teachers?error=Username already exists');
    }

    await createTeacherWithUser(username, password, first_name, middle_name, last_name, class_id || null);
    res.redirect('/admin/teachers');
  } catch (error) {
    console.error('Create teacher error:', error);
    res.redirect('/admin/teachers?error=Failed to create teacher');
  }
});

router.delete('/teachers/:id', isAdmin, (req, res) => {
  try {
    deleteTeacher(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete teacher' });
  }
});

router.put('/teachers/:id/class', isAdmin, (req, res) => {
  try {
    const { class_id } = req.body;
    updateTeacherClass(req.params.id, class_id || null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update teacher class' });
  }
});

router.get('/students', isAdmin, (req, res) => {
  const students = getAllStudents();
  const classes = getAllClasses();
  res.render('admin/students', { students, classes, title: 'Manage Students' });
});

router.post('/students', isAdmin, async (req, res) => {
  try {
    const { first_name, middle_name, last_name, age, class_id, username, password, email } = req.body;

    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return res.redirect('/admin/students?error=Username already exists');
    }

    const db = require('../config/database');
    const classObj = db.get('SELECT name FROM classes WHERE id = ?', [class_id]);
    if (!classObj) {
      return res.redirect('/admin/students?error=Selected class does not exist');
    }

    const reg_no = generateRegNo();

    const userId = await createStudentWithUser(username, password, first_name, middle_name, last_name, age, class_id, reg_no, email || null);

    res.redirect('/admin/students');
  } catch (error) {
    console.error('Create student error:', error);
    res.redirect('/admin/students?error=Failed to create student');
  }
});

router.put('/students/:id', isAdmin, async (req, res) => {
  try {
    const { first_name, middle_name, last_name, age, class_id, email } = req.body;
    const existingUser = get('SELECT u.username, s.class_id FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [req.params.id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    if (existingUser.class_id !== parseInt(class_id)) {
      const db = require('../config/database');
      const classObj = db.get('SELECT name FROM classes WHERE id = ?', [class_id]);
      if (!classObj) {
        return res.status(400).json({ success: false, error: 'Selected class does not exist' });
      }
    }
    updateStudent(parseInt(req.params.id), first_name, middle_name, last_name, parseInt(age), parseInt(class_id));
    if (email !== undefined) {
      const student = get('SELECT id FROM students WHERE id = ?', [req.params.id]);
      if (student) {
        run('UPDATE students SET email = ? WHERE id = ?', [email, parseInt(req.params.id)]);
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
});

router.delete('/students/:id', isAdmin, (req, res) => {
  try {
    deleteStudent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
});

router.post('/students/:id/reset-password', isAdmin, async (req, res) => {
  try {
    const student = get('SELECT user_id FROM students WHERE id = ?', [req.params.id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    await resetUserPassword(student.user_id);
    res.json({ success: true, message: 'Password reset to 12345678. Student must change on next login.' });
  } catch (error) {
    console.error('Reset student password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

router.get('/grading', isAdmin, (req, res) => {
  const grades = getGradingSystem();
  res.render('admin/grading', { grades, title: 'Grading System' });
});

router.post('/grading', isAdmin, (req, res) => {
  try {
    const { grade, min_score, max_score, remark } = req.body;
    addGrade(grade, parseInt(min_score), parseInt(max_score), remark);
    res.redirect('/admin/grading');
  } catch (error) {
    console.error('Create grade error:', error);
    res.redirect('/admin/grading?error=Failed to create grade');
  }
});

router.delete('/grading/:id', isAdmin, (req, res) => {
  try {
    deleteGrade(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete grade' });
  }
});

router.get('/email-settings', isAdmin, (req, res) => {
  const smtp_host = getEmailSetting('smtp_host') || '';
  const smtp_port = getEmailSetting('smtp_port') || '587';
  const smtp_user = getEmailSetting('smtp_user') || '';
  const smtp_pass = getEmailSetting('smtp_pass') || '';
  const from_name = getEmailSetting('from_name') || 'SIMS School';
  res.render('admin/email-settings', {
    smtp_host, smtp_port, smtp_user, smtp_pass, from_name,
    success: req.query.success,
    error: req.query.error,
    title: 'Email Settings'
  });
});

router.post('/email-settings', isAdmin, (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name } = req.body;
    setEmailSetting('smtp_host', smtp_host);
    setEmailSetting('smtp_port', smtp_port);
    setEmailSetting('smtp_user', smtp_user);
    setEmailSetting('smtp_pass', smtp_pass);
    setEmailSetting('from_name', from_name);
    res.redirect('/admin/email-settings?success=Email settings saved');
  } catch (error) {
    console.error('Save email settings error:', error);
    res.redirect('/admin/email-settings?error=Failed to save settings');
  }
});

router.get('/school-settings', isAdmin, (req, res) => {
  const school = getSchoolSettings();
  const adminUser = get('SELECT id, username, email FROM users WHERE id = ?', [req.session.userId]);
  res.render('admin/school-settings', {
    school, title: 'School Settings',
    success: req.query.success, error: req.query.error,
    adminUser,
  });
});

router.post('/school-settings', isAdmin, (req, res) => {
  try {
    const { school_name, school_short_name, primary_color } = req.body;
    updateSchoolSetting('school_name', school_name);
    updateSchoolSetting('school_short_name', school_short_name);
    updateSchoolSetting('primary_color', primary_color);
    res.redirect('/admin/school-settings?success=School settings updated');
  } catch (error) {
    console.error('Save school settings error:', error);
    res.redirect('/admin/school-settings?error=Failed to save settings');
  }
});

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => cb(null, 'school-logo' + path.extname(file.originalname)),
});
const logoUpload = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

router.post('/school-settings/logo', isAdmin, logoUpload.single('logo'), (req, res) => {
  try {
    if (req.file) {
      updateSchoolSetting('logo_path', '/uploads/' + req.file.filename);
    }
    res.redirect('/admin/school-settings?success=Logo uploaded');
  } catch (error) {
    console.error('Logo upload error:', error);
    res.redirect('/admin/school-settings?error=Failed to upload logo');
  }
});

router.post('/school-settings/remove-logo', isAdmin, (req, res) => {
  updateSchoolSetting('logo_path', '');
  res.redirect('/admin/school-settings?success=Logo removed');
});

router.post('/account/update', isAdmin, async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.session.userId;

    const existing = get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
    if (existing) {
      return res.redirect('/admin/school-settings?error=Username already taken');
    }

    if (email && email.trim()) {
      run('UPDATE users SET email = ? WHERE id = ?', [email.trim(), userId]);
    }
    if (username && username.trim()) {
      run('UPDATE users SET username = ? WHERE id = ?', [username.trim(), userId]);
      req.session.username = username.trim();
    }

    res.redirect('/admin/school-settings?success=Account updated');
  } catch (error) {
    console.error('Account update error:', error);
    res.redirect('/admin/school-settings?error=Failed to update account');
  }
});

router.get('/results', isAdmin, (req, res) => {
  const { class_id, student_id, session_id, term_id } = req.query;

  const classes = getAllClasses();
  const sessions = getAllSessions();
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();

  let students = [];
  let results = [];
  let selectedClass = null;
  let selectedStudent = null;
  const sid = session_id ? parseInt(session_id) : (currentSession ? currentSession.id : null);
  const tid = term_id ? parseInt(term_id) : (currentTerm ? currentTerm.id : null);

  let availableTerms = [];
  if (sid) {
    availableTerms = getTermsBySession(sid);
  }

  if (class_id) {
    selectedClass = get('SELECT * FROM classes WHERE id = ?', [class_id]);
    if (selectedClass) {
      students = getStudentsByClassId(class_id);
    }
  }

  if (student_id) {
    selectedStudent = getStudentById(student_id);
    if (selectedStudent) {
      results = query('SELECT r.*, sub.name as subject_name FROM results r JOIN subjects sub ON r.subject_id = sub.id WHERE r.student_id = ? ORDER BY r.term, r.session DESC', [student_id]);
    }
  }

  let pendingCount = 0;
  if (selectedStudent) {
    pendingCount = query('SELECT COUNT(*) as count FROM results WHERE student_id = ? AND status = ?', [selectedStudent.id, 'pending'])[0]?.count || 0;
  }

  res.render('admin/results', { classes, students, results, selectedClass, selectedStudent, sessions, currentSession, currentTerm, selectedSessionId: sid, selectedTermId: tid, availableTerms, pendingCount, title: 'Results Approval' });
});

router.post('/results/:id/approve', isAdmin, async (req, res) => {
  try {
    const result = get('SELECT r.*, s.id as student_id FROM results r JOIN students s ON r.student_id = s.id WHERE r.id = ?', [req.params.id]);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    approveResult(req.params.id);
    sendResultApprovalEmail(result.student_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve result' });
  }
});

router.put('/results/:id', isAdmin, (req, res) => {
  try {
    const { ca_score, exam_score } = req.body;
    const result = get('SELECT * FROM results WHERE id = ?', [req.params.id]);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }

    const total = parseFloat(ca_score) + parseFloat(exam_score);
    const grade = calculateGrade(total);

    run('UPDATE results SET ca_score = ?, exam_score = ?, total = ?, grade = ? WHERE id = ?',
      [ca_score, exam_score, total, grade, req.params.id]);

    sendResultEditEmail(parseInt(req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error('Update result error:', error);
    res.status(500).json({ success: false, error: 'Failed to update result' });
  }
});

router.post('/results/:id/reject', isAdmin, (req, res) => {
  try {
    rejectResult(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject result' });
  }
});

router.post('/results/student/:student_id/approve-all', isAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.student_id);
    const student = getStudentById(studentId);
    
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const pendingResults = query('SELECT r.* FROM results r WHERE r.student_id = ? AND r.status = ?', [studentId, 'pending']);
    let approvedCount = 0;

    for (const r of pendingResults) {
      approveResult(r.id);
      approvedCount++;
    }

    if (approvedCount > 0) {
      await sendResultApprovalEmail(studentId);
    }

    res.json({ success: true, approved: approvedCount });
  } catch (error) {
    console.error('Approve all error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve results' });
  }
});

router.get('/attendance', isAdmin, (req, res) => {
  const { date, class_id, session_id, term_id } = req.query;
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();

  const defaultDate = new Date().toISOString().split('T')[0];
  const useDate = date || defaultDate;
  const sid = session_id ? parseInt(session_id) : (currentSession ? currentSession.id : null);
  const tid = term_id ? parseInt(term_id) : (currentTerm ? currentTerm.id : null);

  const attendance = getAllAttendance(useDate, class_id, sid, tid);
  const classes = getAllClasses();
  const sessions = getAllSessions();

  let reportClassName = 'All Classes';
  if (class_id) {
    const cls = get('SELECT name, arm FROM classes WHERE id = ?', [class_id]);
    if (cls) reportClassName = cls.name + (cls.arm ? ' ' + cls.arm : '');
  }

  const reportFormattedDate = new Date(useDate + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const reportPresent = attendance.filter(r => r.status === 'present').length;
  const reportAbsent = attendance.filter(r => r.status === 'absent').length;
  const reportLate = attendance.filter(r => r.status === 'late').length;

  res.render('admin/attendance', {
    attendance, classes, sessions, currentSession, currentTerm,
    selectedDate: useDate, selectedClass: class_id, selectedSessionId: sid, selectedTermId: tid,
    reportClassName, reportFormattedDate, reportPresent, reportAbsent, reportLate,
    title: 'Attendance'
  });
});

router.get('/report-card', isAdmin, (req, res) => {
  const { student_id, session_id, term_id } = req.query;
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();
  const sid = session_id ? parseInt(session_id) : (currentSession ? currentSession.id : null);
  const tid = term_id ? parseInt(term_id) : (currentTerm ? currentTerm.id : null);

  if (!student_id || !sid || !tid) {
    return res.redirect('/admin/results?error=Select a student, session, and term to print report card');
  }

  const student = getStudentById(student_id);
  if (!student) {
    return res.redirect('/admin/results?error=Student not found');
  }

  const results = query(`
    SELECT r.*, sub.name as subject_name
    FROM results r
    JOIN subjects sub ON r.subject_id = sub.id
    WHERE r.student_id = ? AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?))) AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?))) AND r.status = 'approved'
    ORDER BY sub.name
  `, [student_id, sid, sid, tid, tid]);

  const session = get('SELECT * FROM sessions WHERE id = ?', [sid]);
  const term = get('SELECT * FROM terms WHERE id = ?', [tid]);
  const grades = getGradingSystem();

  const totalScore = results.reduce((sum, r) => sum + r.total, 0);
  const avgScore = results.length > 0 ? (totalScore / results.length).toFixed(2) : 0;

  const db = require('../config/database');
  const totalAttendance = db.get('SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND session_id = ? AND term_id = ?', [student_id, sid, tid]).count;
  const presentCount = db.get("SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = 'present' AND session_id = ? AND term_id = ?", [student_id, sid, tid]).count;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const classRankData = query(`
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
    if (classRankData[i].id == student_id) {
      classPosition = i + 1;
      break;
    }
  }

  const totalStudents = classRankData.length;

  res.render('admin/report-card', {
    student, results, session, term, grades, avgScore, attendanceRate,
    classPosition, totalStudents, title: 'Report Card - ' + student.first_name + ' ' + student.last_name
  });
});

router.get('/newsletter', isAdmin, (req, res) => {
  const studentCount = get("SELECT COUNT(*) as count FROM students WHERE email IS NOT NULL AND email != ''").count;
  const classes = getAllClasses();
  const students = getAllStudents();
  res.render('admin/newsletter', {
    success: req.query.success,
    error: req.query.error,
    title: 'Newsletter',
    studentCount,
    classes,
    students,
  });
});

router.post('/newsletter', isAdmin, async (req, res) => {
  const { subject, body, recipient_type, class_id, student_ids } = req.body;
  if (!subject || !body) {
    return res.redirect('/admin/newsletter?error=Subject and body are required');
  }

  let filter = {};
  let label = '';

  if (recipient_type === 'class' && class_id) {
    filter = { class_id: parseInt(class_id) };
    const cls = get('SELECT name, arm FROM classes WHERE id = ?', [class_id]);
    label = cls ? `${cls.name} ${cls.arm || ''}` : 'Class';
  } else if (recipient_type === 'selected' && student_ids) {
    const ids = Array.isArray(student_ids) ? student_ids.map(Number) : [parseInt(student_ids)];
    filter = { student_ids: ids };
    label = `${ids.length} selected student(s)`;
  }

  filter.label = label;
  const result = await sendNewsletter(subject, body, filter);
  res.redirect(`/admin/newsletter?success=Newsletter sent! Delivered: ${result.sent}, Failed: ${result.failed}, Total recipients: ${result.total} ${label ? '| Recipients: ' + label : ''}`);
});

router.get('/verify', isAdmin, (req, res) => {
  res.render('admin/verify', {
    result: null,
    code: req.query.code || '',
    title: 'Verify Result'
  });
});

router.post('/verify', isAdmin, (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.render('admin/verify', { result: null, code: '', error: 'Enter a verification code', title: 'Verify Result' });
  }
  const data = verifyCode(code.trim());
  res.render('admin/verify', { result: data, code: code.trim(), error: data ? null : 'Invalid or expired verification code', title: 'Verify Result' });
});

router.get('/lockouts', isAdmin, (req, res) => {
  const lockedUsers = getLockedUsers();
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  lockedUsers.forEach(u => {
    if (u.locked_until && u.locked_until > now) {
      u.is_locked = true;
    } else if (u.lock_level === 3) {
      u.is_locked = true;
    } else {
      u.is_locked = false;
    }
  });
  res.render('admin/lockouts', {
    lockedUsers, now,
    success: req.query.success,
    error: req.query.error,
    title: 'Locked Accounts'
  });
});

router.post('/lockouts/:id/unlock', isAdmin, (req, res) => {
  try {
    adminUnlockOTP(parseInt(req.params.id));
    res.json({ success: true, message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ success: false, error: 'Failed to unlock account' });
  }
});

module.exports = router;
