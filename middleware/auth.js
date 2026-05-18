const { getUserById, getStudentByUserId, getTeacherByUserId } = require('../models/db');

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    const user = getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
      return;
    }
    return next();
  }
  res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Admin only.' });
};

const isTeacher = (req, res, next) => {
  if (req.session && req.session.role === 'teacher') {
    const teacher = getTeacherByUserId(req.session.userId);
    if (!teacher) {
      req.session.destroy(() => {
        return res.status(404).render('error', { message: 'Teacher record not found. Please contact admin or login again.' });
      });
      return;
    }
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Teacher only.' });
};

const isStudent = (req, res, next) => {
  if (req.session && req.session.role === 'student') {
    const student = getStudentByUserId(req.session.userId);
    if (!student) {
      req.session.destroy(() => {
        return res.status(404).render('error', { message: 'Student record not found. Please contact admin or login again.' });
      });
      return;
    }
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Student only.' });
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isTeacher,
  isStudent,
};
