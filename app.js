require('dotenv').config();
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { initDB } = require('./config/database');
const { seedDefaultData, getCurrentSession, getCurrentTerm, getSchoolSettings } = require('./models/db');
const multer = require('multer');
const upload = multer({ dest: path.join(__dirname, 'public', 'uploads') });

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(expressLayouts);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'sims_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use((req, res, next) => {
  res.locals.user = req.session ? {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
  } : null;
  const currentSession = getCurrentSession();
  const currentTerm = getCurrentTerm();
  res.locals.currentSession = currentSession;
  res.locals.currentTerm = currentTerm;
  const school = getSchoolSettings();
  res.locals.school = school;
  next();
});

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const apiRoutes = require('./routes/api');

app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);
app.use('/student', studentRoutes);
app.use('/api', apiRoutes);

app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  switch (req.session.role) {
    case 'admin': res.redirect('/admin/dashboard'); break;
    case 'teacher': res.redirect('/teacher/dashboard'); break;
    case 'student': res.redirect('/student/dashboard'); break;
    default: res.redirect('/login');
  }
});

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found', title: '404' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something went wrong!', title: 'Error' });
});

async function start() {
  await initDB();
  await seedDefaultData();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMS is running on http://localhost:${PORT}`);
    console.log(`Access from other devices: http://YOUR_IP_ADDRESS:${PORT}`);
    console.log('Default admin: username=admin, password=admin123');
  });
}

start();
