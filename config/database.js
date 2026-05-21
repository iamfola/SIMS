const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'school.db');
const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !!DATABASE_URL;

let db;
let pool;

function translateSQL(sql) {
  if (!isPostgres) return sql;
  return sql
    .replace(/datetime\('now'\)/g, "NOW()::text")
    .replace(/'now'/g, "NOW()")
    .replace(/last_insert_rowid\(\)/g, "LASTVAL()")
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY")
    .replace(/INSERT OR REPLACE/g, "INSERT")
    .replace(/INSERT OR IGNORE/g, "INSERT");
}

function convertPlaceholders(sql) {
  if (!isPostgres) return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function _queryPostgres(sql, params = []) {
  const text = convertPlaceholders(translateSQL(sql));
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (err) {
    if (err.code === '42P01' || err.code === '42703' || (err.message && err.message.includes('does not exist'))) {
      await initSchema();
      const result = await pool.query(text, params);
      return result.rows;
    }
    throw err;
  }
}

async function _runPostgres(sql, params = []) {
  const trimmed = sql.trim();
  const isInsert = /^INSERT/i.test(trimmed) && !/RETURNING/i.test(trimmed);
  let text = convertPlaceholders(translateSQL(sql));
  if (isInsert) {
    text += ' RETURNING id';
  }
  try {
    const result = await pool.query(text, params);
    if (isInsert && result.rows.length > 0) {
      return result.rows[0].id;
    }
    return result.rowCount || null;
  } catch (err) {
    if (isInsert && (err.code === '42703' || (err.message && err.message.includes('does not exist')))) {
      const result = await pool.query(convertPlaceholders(translateSQL(sql)), params);
      return result.rowCount || null;
    }
    throw err;
  }
}

function query(sql, params = []) {
  if (isPostgres) {
    return _queryPostgres(sql, params);
  }
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
  if (isPostgres) {
    return _queryPostgres(sql, params).then(rows => rows.length > 0 ? rows[0] : null);
  }
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  if (isPostgres) {
    return _runPostgres(sql, params);
  }
  db.run(sql, params);
  const lastRow = query('SELECT last_insert_rowid() as id');
  if (Array.isArray(lastRow)) {
    return lastRow.length > 0 ? lastRow[0].id : null;
  }
  return null;
}

async function columnExists(table, column) {
  if (!isPostgres) return false;
  const row = await get(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    [table, column]
  );
  return !!row;
}

async function ensureColumn(table, column, type, constraint) {
  if (!isPostgres) {
    try {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type || 'TEXT'}${constraint ? ' ' + constraint : ''}`);
    } catch (e) {}
    return;
  }
  const exists = await columnExists(table, column);
  if (!exists) {
    try {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type || 'TEXT'}${constraint ? ' ' + constraint : ''}`);
    } catch (e) {}
  }
}

async function initSchema() {
  if (isPostgres) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
        must_change_password INTEGER DEFAULT 1,
        email TEXT,
        login_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        session_token TEXT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        arm TEXT NOT NULL,
        UNIQUE(name, arm)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        first_name TEXT NOT NULL,
        middle_name TEXT,
        last_name TEXT NOT NULL,
        age INTEGER NOT NULL,
        class_id INTEGER NOT NULL REFERENCES classes(id),
        reg_no TEXT UNIQUE NOT NULL,
        email TEXT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        first_name TEXT NOT NULL,
        middle_name TEXT,
        last_name TEXT NOT NULL,
        class_id INTEGER REFERENCES classes(id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_subjects (
        id SERIAL PRIMARY KEY,
        class_id INTEGER NOT NULL REFERENCES classes(id),
        subject_id INTEGER NOT NULL REFERENCES subjects(id),
        teacher_id INTEGER REFERENCES teachers(id),
        UNIQUE(class_id, subject_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 0
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS terms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        is_active INTEGER DEFAULT 0,
        UNIQUE(name, session_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id),
        subject_id INTEGER NOT NULL REFERENCES subjects(id),
        ca_score REAL DEFAULT 0,
        exam_score REAL DEFAULT 0,
        total REAL DEFAULT 0,
        grade TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        term TEXT NOT NULL,
        session TEXT NOT NULL,
        session_id INTEGER REFERENCES sessions(id),
        term_id INTEGER REFERENCES terms(id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id),
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
        marked_by INTEGER NOT NULL REFERENCES teachers(id),
        session_id INTEGER REFERENCES sessions(id),
        term_id INTEGER REFERENCES terms(id),
        UNIQUE(student_id, date)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grading_system (
        id SERIAL PRIMARY KEY,
        grade TEXT UNIQUE NOT NULL,
        min_score INTEGER NOT NULL,
        max_score INTEGER NOT NULL,
        remark TEXT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verifications (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        student_id INTEGER NOT NULL REFERENCES students(id),
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        term_id INTEGER NOT NULL REFERENCES terms(id),
        results_hash TEXT,
        created_at TEXT DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        otp TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_lockouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        failed_attempts INTEGER DEFAULT 0,
        lock_level INTEGER DEFAULT 0,
        locked_until TEXT,
        created_at TEXT DEFAULT NOW(),
        updated_at TEXT DEFAULT NOW()
      )
    `);
    return;
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
  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      class_id INTEGER REFERENCES classes(id)
    )
  `);
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
  try { db.run(`ALTER TABLE users ADD COLUMN email TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN locked_until TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN session_token TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE verifications ADD COLUMN results_hash TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE results ADD COLUMN session_id INTEGER REFERENCES sessions(id)`); } catch (e) {}
  try { db.run(`ALTER TABLE results ADD COLUMN term_id INTEGER REFERENCES terms(id)`); } catch (e) {}
  try { db.run(`ALTER TABLE attendance ADD COLUMN session_id INTEGER REFERENCES sessions(id)`); } catch (e) {}
  try { db.run(`ALTER TABLE attendance ADD COLUMN term_id INTEGER REFERENCES terms(id)`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN email TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE teachers ADD COLUMN first_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE teachers ADD COLUMN middle_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE teachers ADD COLUMN last_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN first_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN middle_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN last_name TEXT`); } catch (e) {}
  saveDB();
}

async function initDB() {
  if (isPostgres) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
    });
    await initSchema();
    return;
  }

  const initSqlJs = require('sql.js');
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
  initSchema();
}

function saveDB() {
  if (!isPostgres && db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

module.exports = { initDB, query, get, run, saveDB, isPostgres, translateSQL };
