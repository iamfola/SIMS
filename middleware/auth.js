const { getUserById, getStudentByUserId, getTeacherByUserId, getSessionToken } = require('../models/db');

const isAuthenticated = async (req, res, next) => {
  if (req.session && req.session.userId) {
    const user = await getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
      return;
    }
    const currentToken = await getSessionToken(req.session.userId);
    if (currentToken && req.session.sessionToken !== currentToken) {
      req.session.destroy(() => {
        res.redirect('/login?error=You have been logged out');
      });
      return;
    }
    return next();
  }
  res.redirect('/login');
};

const isAdmin = async (req, res, next) => {
  if (req.session && req.session.role === 'admin') {
    const currentToken = await getSessionToken(req.session.userId);
    if (currentToken && req.session.sessionToken !== currentToken) {
      req.session.destroy(() => {
        res.redirect('/login?error=You have been logged out');
      });
      return;
    }
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Admin only.' });
};

const isTeacher = async (req, res, next) => {
  if (req.session && req.session.role === 'teacher') {
    const teacher = await getTeacherByUserId(req.session.userId);
    if (!teacher) {
      req.session.destroy(() => {
        return res.status(404).render('error', { message: 'Teacher record not found. Please contact admin or login again.' });
      });
      return;
    }
    const currentToken = await getSessionToken(req.session.userId);
    if (currentToken && req.session.sessionToken !== currentToken) {
      req.session.destroy(() => {
        res.redirect('/login?error=You have been logged out');
      });
      return;
    }
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Teacher only.' });
};

const isStudent = async (req, res, next) => {
  if (req.session && req.session.role === 'student') {
    const student = await getStudentByUserId(req.session.userId);
    if (!student) {
      req.session.destroy(() => {
        return res.status(404).render('error', { message: 'Student record not found. Please contact admin or login again.' });
      });
      return;
    }
    const currentToken = await getSessionToken(req.session.userId);
    if (currentToken && req.session.sessionToken !== currentToken) {
      req.session.destroy(() => {
        res.redirect('/login?error=You have been logged out');
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