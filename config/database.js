const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'school.db');

let db;

async function initDB() {
  const wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  try {
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch (e) {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      must_change_password INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      arm TEXT NOT NULL,
      UNIQUE(name, arm)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      class_id INTEGER NOT NULL REFERENCES classes(id),
      reg_no TEXT UNIQUE NOT NULL
    )
  `);

  try { db.run(`ALTER TABLE students ADD COLUMN first_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN middle_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN last_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN email TEXT`); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      class_id INTEGER REFERENCES classes(id)
    )
  `);

  try { db.run(`ALTER TABLE teachers ADD COLUMN first_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE teachers ADD COLUMN middle_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE teachers ADD COLUMN last_name TEXT`); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS class_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id),
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      teacher_id INTEGER REFERENCES teachers(id),
      UNIQUE(class_id, subject_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      ca_score REAL DEFAULT 0,
      exam_score REAL DEFAULT 0,
      total REAL DEFAULT 0,
      grade TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      term TEXT NOT NULL,
      session TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
      marked_by INTEGER NOT NULL REFERENCES teachers(id),
      UNIQUE(student_id, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      is_active INTEGER DEFAULT 0,
      UNIQUE(name, session_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS grading_system (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade TEXT UNIQUE NOT NULL,
      min_score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      remark TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id),
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      term_id INTEGER NOT NULL REFERENCES terms(id),
      results_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      otp TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS otp_lockouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      failed_attempts INTEGER DEFAULT 0,
      lock_level INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try {
    db.run(`ALTER TABLE users ADD COLUMN email TEXT`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE verifications ADD COLUMN results_hash TEXT`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE results ADD COLUMN session_id INTEGER REFERENCES sessions(id)`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE results ADD COLUMN term_id INTEGER REFERENCES terms(id)`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE attendance ADD COLUMN session_id INTEGER REFERENCES sessions(id)`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE attendance ADD COLUMN term_id INTEGER REFERENCES terms(id)`);
  } catch (e) {}

  saveDB();
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function get(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const lastRow = query('SELECT last_insert_rowid() as id');
  saveDB();
  return lastRow[0]?.id;
}

module.exports = { initDB, db, query, run, get, saveDB };

