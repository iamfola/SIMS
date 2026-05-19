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
  getLockedUsers, adminUnlockAccount,
  getSchoolSettings, updateSchoolSetting,
} = require('../models/db');
const { isAdmin } = require('../middleware/auth');

router.get('/dashboard', isAdmin, async (req, res) => {
  const db = require('../config/database');
  const studentCount = (await db.get('SELECT COUNT(*) as count FROM students')).count;
  const teacherCount = (await db.get('SELECT COUNT(*) as count FROM teachers')).count;
  const classCount = (await db.get('SELECT COUNT(*) as count FROM classes')).count;
  const pendingResults = (await getPendingResults()).length;
  const lockedCount = (await db.get('SELECT COUNT(*) as count FROM otp_lockouts WHERE lock_level > 0')).count;

  res.render('admin/dashboard', {
    studentCount, teacherCount, classCount, pendingResults, lockedCount,
    title: 'Admin Dashboard'
  });
});

router.put('/teachers/:id', isAdmin, async (req, res) => {
  try {
    const { first_name, middle_name, last_name, class_id } = req.body;
    const existingTeacher = await get('SELECT id FROM teachers WHERE id = ?', [req.params.id]);
    if (!existingTeacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    await updateTeacher(parseInt(req.params.id), first_name, middle_name, last_name, class_id || null);
    res.json({ success: true });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ success: false, error: 'Failed to update teacher' });
  }
});

router.post('/teachers/:id/reset-password', isAdmin, async (req, res) => {
  try {
    const teacher = await get('SELECT user_id FROM teachers WHERE id = ?', [req.params.id]);
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

router.get('/sessions', isAdmin, async (req, res) => {
  const sessions = await getAllSessions();
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();
  const terms = currentSession ? await getTermsBySession(currentSession.id) : [];

  res.render('admin/sessions', {
    sessions, currentSession, currentTerm, terms,
    success: req.query.success,
    error: req.query.error,
    title: 'Academic Sessions'
  });
});

router.post('/sessions', isAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    await createSession(name);
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Create session error:', error);
    res.redirect('/admin/sessions?error=Failed to create session');
  }
});

router.post('/sessions/:id/activate', isAdmin, async (req, res) => {
  try {
    await setActiveSession(parseInt(req.params.id));
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Activate session error:', error);
    res.redirect('/admin/sessions?error=Failed to activate session');
  }
});

router.post('/sessions/switch', isAdmin, async (req, res) => {
  try {
    const { session_id, promote } = req.body;
    console.log(`[Session Switch] session_id=${session_id}, promote=${promote}`);
    await setActiveSession(parseInt(session_id));
    let promotionResult = null;
    if (promote === 'on' || promote === 'true' || promote === '1') {
      console.log('[Session Switch] Promotion enabled, running promoteStudents()');
      promotionResult = await promoteStudents();
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

router.delete('/sessions/:id', isAdmin, async (req, res) => {
  try {
    const result = await deleteSession(parseInt(req.params.id));
    if (result === null) {
      return res.status(400).json({ success: false, error: 'Cannot delete active session' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

router.post('/terms', isAdmin, async (req, res) => {
  try {
    const { name, session_id } = req.body;
    await createTerm(name, parseInt(session_id));
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Create term error:', error);
    res.redirect('/admin/sessions?error=Failed to create term');
  }
});

router.post('/terms/:id/activate', isAdmin, async (req, res) => {
  try {
    await setActiveTerm(parseInt(req.params.id));
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Activate term error:', error);
    res.redirect('/admin/sessions?error=Failed to activate term');
  }
});

router.delete('/terms/:id', isAdmin, async (req, res) => {
  try {
    const result = await deleteTerm(parseInt(req.params.id));
    if (result === null) {
      return res.status(400).json({ success: false, error: 'Cannot delete active term' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete term' });
  }
});

router.get('/classes', isAdmin, async (req, res) => {
  const classes = await getAllClasses();
  res.render('admin/classes', { classes, title: 'Manage Classes' });
});

router.post('/classes', isAdmin, async (req, res) => {
  try {
    const { name, arm } = req.body;
    await createClass(name, arm);
    res.redirect('/admin/classes');
  } catch (error) {
    console.error('Create class error:', error);
    res.redirect('/admin/classes?error=Failed to create class');
  }
});

router.delete('/classes/:id', isAdmin, async (req, res) => {
  try {
    await deleteClass(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete class' });
  }
});

router.get('/subjects', isAdmin, async (req, res) => {
  const subjects = await getAllSubjects();
  const classes = await getAllClasses();
  const classSubjects = await getClassSubjects();
  const teachers = await getAllTeachers();

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

router.post('/subjects', isAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    await createSubject(name);
    res.redirect('/admin/subjects');
  } catch (error) {
    console.error('Create subject error:', error);
    res.redirect('/admin/subjects?error=Failed to create subject');
  }
});

router.post('/class-subjects', isAdmin, async (req, res) => {
  try {
    const { class_id, subject_id, teacher_id } = req.body;
    await assignClassSubject(class_id, subject_id, teacher_id || null);
    res.redirect('/admin/subjects');
  } catch (error) {
    console.error('Assign subject error:', error);
    res.redirect('/admin/subjects?error=Failed to assign subject');
  }
});

router.delete('/class-subjects/:id', isAdmin, async (req, res) => {
  try {
    await run('DELETE FROM class_subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete class subject error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete assignment' });
  }
});

router.put('/class-subjects/:id', isAdmin, async (req, res) => {
  try {
    const { teacher_id } = req.body;
    await run('UPDATE class_subjects SET teacher_id = ? WHERE id = ?', [teacher_id || null, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Update class subject error:', error);
    res.status(500).json({ success: false, error: 'Failed to update assignment' });
  }
});

router.get('/teachers', isAdmin, async (req, res) => {
  const teachers = await getAllTeachers();
  const classes = await getAllClasses();
  res.render('admin/teachers', { teachers, classes, title: 'Manage Teachers' });
});

router.post('/teachers', isAdmin, async (req, res) => {
  try {
    const { username, password, first_name, middle_name, last_name, class_id } = req.body;

    const existingUser = await getUserByUsername(username);
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

router.delete('/teachers/:id', isAdmin, async (req, res) => {
  try {
    await deleteTeacher(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete teacher' });
  }
});

router.put('/teachers/:id/class', isAdmin, async (req, res) => {
  try {
    const { class_id } = req.body;
    await updateTeacherClass(req.params.id, class_id || null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update teacher class' });
  }
});

router.get('/students', isAdmin, async (req, res) => {
  const students = await getAllStudents();
  const classes = await getAllClasses();
  res.render('admin/students', { students, classes, title: 'Manage Students' });
});

router.post('/students', isAdmin, async (req, res) => {
  try {
    const { first_name, middle_name, last_name, age, class_id, username, password, email } = req.body;

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.redirect('/admin/students?error=Username already exists');
    }

    const db = require('../config/database');
    const classObj = await db.get('SELECT name FROM classes WHERE id = ?', [class_id]);
    if (!classObj) {
      return res.redirect('/admin/students?error=Selected class does not exist');
    }

    const reg_no = await generateRegNo();

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
    const existingUser = await get('SELECT u.username, s.class_id FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [req.params.id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    if (existingUser.class_id !== parseInt(class_id)) {
      const db = require('../config/database');
      const classObj = await db.get('SELECT name FROM classes WHERE id = ?', [class_id]);
      if (!classObj) {
        return res.status(400).json({ success: false, error: 'Selected class does not exist' });
      }
    }
    await updateStudent(parseInt(req.params.id), first_name, middle_name, last_name, parseInt(age), parseInt(class_id));
    if (email !== undefined) {
      const student = await get('SELECT id FROM students WHERE id = ?', [req.params.id]);
      if (student) {
        await run('UPDATE students SET email = ? WHERE id = ?', [email, parseInt(req.params.id)]);
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
});

router.delete('/students/:id', isAdmin, async (req, res) => {
  try {
    await deleteStudent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
});

router.post('/students/:id/reset-password', isAdmin, async (req, res) => {
  try {
    const student = await get('SELECT user_id FROM students WHERE id = ?', [req.params.id]);
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

router.get('/grading', isAdmin, async (req, res) => {
  const grades = await getGradingSystem();
  res.render('admin/grading', { grades, title: 'Grading System' });
});

router.post('/grading', isAdmin, async (req, res) => {
  try {
    const { grade, min_score, max_score, remark } = req.body;
    await addGrade(grade, parseInt(min_score), parseInt(max_score), remark);
    res.redirect('/admin/grading');
  } catch (error) {
    console.error('Create grade error:', error);
    res.redirect('/admin/grading?error=Failed to create grade');
  }
});

router.delete('/grading/:id', isAdmin, async (req, res) => {
  try {
    await deleteGrade(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete grade' });
  }
});

router.get('/email-settings', isAdmin, async (req, res) => {
  const email_provider = await getEmailSetting('email_provider') || 'smtp';
  const smtp_host = await getEmailSetting('smtp_host') || '';
  const smtp_port = await getEmailSetting('smtp_port') || '587';
  const smtp_user = await getEmailSetting('smtp_user') || '';
  const smtp_pass = await getEmailSetting('smtp_pass') || '';
  const from_name = await getEmailSetting('from_name') || 'SIMS School';
  const sendgrid_api_key = await getEmailSetting('sendgrid_api_key') || '';
  res.render('admin/email-settings', {
    email_provider, smtp_host, smtp_port, smtp_user, smtp_pass, from_name, sendgrid_api_key,
    success: req.query.success,
    error: req.query.error,
    title: 'Email Settings'
  });
});

router.post('/email-settings', isAdmin, async (req, res) => {
  try {
    const { email_provider, smtp_host, smtp_port, smtp_user, smtp_pass, from_name, sendgrid_api_key } = req.body;
    await setEmailSetting('email_provider', email_provider === 'sendgrid' ? 'sendgrid' : 'smtp');
    await setEmailSetting('smtp_host', smtp_host || '');
    await setEmailSetting('smtp_port', smtp_port || '587');
    await setEmailSetting('smtp_user', smtp_user || '');
    await setEmailSetting('smtp_pass', smtp_pass || '');
    await setEmailSetting('from_name', from_name || 'SIMS School');
    await setEmailSetting('sendgrid_api_key', sendgrid_api_key || '');
    res.redirect('/admin/email-settings?success=Email settings saved');
  } catch (error) {
    console.error('Save email settings error:', error);
    res.redirect('/admin/email-settings?error=Failed to save settings');
  }
});

router.get('/school-settings', isAdmin, async (req, res) => {
  const school = await getSchoolSettings();
  const adminUser = await get('SELECT id, username, email FROM users WHERE id = ?', [req.session.userId]);
  res.render('admin/school-settings', {
    school, title: 'School Settings',
    success: req.query.success, error: req.query.error,
    adminUser,
  });
});

router.post('/school-settings', isAdmin, async (req, res) => {
  try {
    const { school_name, school_short_name, primary_color } = req.body;
    await updateSchoolSetting('school_name', school_name);
    await updateSchoolSetting('school_short_name', school_short_name);
    await updateSchoolSetting('primary_color', primary_color);
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

router.post('/school-settings/logo', isAdmin, logoUpload.single('logo'), async (req, res) => {
  try {
    if (req.file) {
      await updateSchoolSetting('logo_path', '/uploads/' + req.file.filename);
    }
    res.redirect('/admin/school-settings?success=Logo uploaded');
  } catch (error) {
    console.error('Logo upload error:', error);
    res.redirect('/admin/school-settings?error=Failed to upload logo');
  }
});

router.post('/school-settings/remove-logo', isAdmin, async (req, res) => {
  await updateSchoolSetting('logo_path', '');
  res.redirect('/admin/school-settings?success=Logo removed');
});

router.post('/account/update', isAdmin, async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.session.userId;

    const existing = await get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
    if (existing) {
      return res.redirect('/admin/school-settings?error=Username already taken');
    }

    if (email && email.trim()) {
      await run('UPDATE users SET email = ? WHERE id = ?', [email.trim(), userId]);
    }
    if (username && username.trim()) {
      await run('UPDATE users SET username = ? WHERE id = ?', [username.trim(), userId]);
      req.session.username = username.trim();
    }

    res.redirect('/admin/school-settings?success=Account updated');
  } catch (error) {
    console.error('Account update error:', error);
    res.redirect('/admin/school-settings?error=Failed to update account');
  }
});

router.get('/results', isAdmin, async (req, res) => {
  const { class_id, student_id, session_id, term_id } = req.query;

  const classes = await getAllClasses();
  const sessions = await getAllSessions();
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();

  let students = [];
  let results = [];
  let selectedClass = null;
  let selectedStudent = null;
  const sid = session_id ? parseInt(session_id) : (currentSession ? currentSession.id : null);
  const tid = term_id ? parseInt(term_id) : (currentTerm ? currentTerm.id : null);

  let availableTerms = [];
  if (sid) {
    availableTerms = await getTermsBySession(sid);
  }

  if (class_id) {
    selectedClass = await get('SELECT * FROM classes WHERE id = ?', [class_id]);
    if (selectedClass) {
      students = await getStudentsByClassId(class_id);
    }
  }

  if (student_id) {
    selectedStudent = await getStudentById(student_id);
    if (selectedStudent) {
      results = await query('SELECT r.*, sub.name as subject_name FROM results r JOIN subjects sub ON r.subject_id = sub.id WHERE r.student_id = ? ORDER BY r.term, r.session DESC', [student_id]);
    }
  }

  let pendingCount = 0;
  if (selectedStudent) {
    pendingCount = (await query('SELECT COUNT(*) as count FROM results WHERE student_id = ? AND status = ?', [selectedStudent.id, 'pending']))[0]?.count || 0;
  }

  res.render('admin/results', { classes, students, results, selectedClass, selectedStudent, sessions, currentSession, currentTerm, selectedSessionId: sid, selectedTermId: tid, availableTerms, pendingCount, title: 'Results Approval' });
});

router.post('/results/:id/approve', isAdmin, async (req, res) => {
  try {
    const result = await get('SELECT r.*, s.id as student_id FROM results r JOIN students s ON r.student_id = s.id WHERE r.id = ?', [req.params.id]);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    await approveResult(req.params.id);
    await sendResultApprovalEmail(result.student_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve result' });
  }
});

router.put('/results/:id', isAdmin, async (req, res) => {
  try {
    const { ca_score, exam_score } = req.body;
    const result = await get('SELECT * FROM results WHERE id = ?', [req.params.id]);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }

    const total = parseFloat(ca_score) + parseFloat(exam_score);
    const grade = await calculateGrade(total);

    await run('UPDATE results SET ca_score = ?, exam_score = ?, total = ?, grade = ? WHERE id = ?',
      [ca_score, exam_score, total, grade, req.params.id]);

    await sendResultEditEmail(parseInt(req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error('Update result error:', error);
    res.status(500).json({ success: false, error: 'Failed to update result' });
  }
});

router.post('/results/:id/reject', isAdmin, async (req, res) => {
  try {
    await rejectResult(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject result' });
  }
});

router.post('/results/student/:student_id/approve-all', isAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.student_id);
    const student = await getStudentById(studentId);
    
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const pendingResults = await query('SELECT r.* FROM results r WHERE r.student_id = ? AND r.status = ?', [studentId, 'pending']);
    let approvedCount = 0;

    for (const r of pendingResults) {
      await approveResult(r.id);
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

router.get('/attendance', isAdmin, async (req, res) => {
  const { date, class_id, session_id, term_id } = req.query;
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();

  const defaultDate = new Date().toISOString().split('T')[0];
  const useDate = date || defaultDate;
  const sid = session_id ? parseInt(session_id) : (currentSession ? currentSession.id : null);
  const tid = term_id ? parseInt(term_id) : (currentTerm ? currentTerm.id : null);

  const attendance = await getAllAttendance(useDate, class_id, sid, tid);
  const classes = await getAllClasses();
  const sessions = await getAllSessions();

  let reportClassName = 'All Classes';
  if (class_id) {
    const cls = await get('SELECT name, arm FROM classes WHERE id = ?', [class_id]);
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

router.get('/report-card', isAdmin, async (req, res) => {
  const { student_id, session_id, term_id } = req.query;
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();
  const sid = session_id ? parseInt(session_id) : (currentSession ? currentSession.id : null);
  const tid = term_id ? parseInt(term_id) : (currentTerm ? currentTerm.id : null);

  if (!student_id || !sid || !tid) {
    return res.redirect('/admin/results?error=Select a student, session, and term to print report card');
  }

  const student = await getStudentById(student_id);
  if (!student) {
    return res.redirect('/admin/results?error=Student not found');
  }

  const results = await query(`
    SELECT r.*, sub.name as subject_name
    FROM results r
    JOIN subjects sub ON r.subject_id = sub.id
    WHERE r.student_id = ? AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?))) AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?))) AND r.status = 'approved'
    ORDER BY sub.name
  `, [student_id, sid, sid, tid, tid]);

  const session = await get('SELECT * FROM sessions WHERE id = ?', [sid]);
  const term = await get('SELECT * FROM terms WHERE id = ?', [tid]);
  const grades = await getGradingSystem();

  const totalScore = results.reduce((sum, r) => sum + r.total, 0);
  const avgScore = results.length > 0 ? (totalScore / results.length).toFixed(2) : 0;

  const db = require('../config/database');
  const totalAttendance = (await db.get('SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND session_id = ? AND term_id = ?', [student_id, sid, tid])).count;
  const presentCount = (await db.get("SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = 'present' AND session_id = ? AND term_id = ?", [student_id, sid, tid])).count;
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

router.get('/newsletter', isAdmin, async (req, res) => {
  const studentCount = (await get("SELECT COUNT(*) as count FROM students WHERE email IS NOT NULL AND email != ''")).count;
  const classes = await getAllClasses();
  const students = await getAllStudents();
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
    const cls = await get('SELECT name, arm FROM classes WHERE id = ?', [class_id]);
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

router.post('/verify', isAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.render('admin/verify', { result: null, code: '', error: 'Enter a verification code', title: 'Verify Result' });
  }
  const data = await verifyCode(code.trim());
  res.render('admin/verify', { result: data, code: code.trim(), error: data ? null : 'Invalid or expired verification code', title: 'Verify Result' });
});

router.get('/lockouts', isAdmin, async (req, res) => {
  const lockedUsers = await getLockedUsers();
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

router.post('/lockouts/:id/unlock', isAdmin, async (req, res) => {
  try {
    await adminUnlockAccount(parseInt(req.params.id));
    res.json({ success: true, message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ success: false, error: 'Failed to unlock account' });
  }
});

module.exports = router;
