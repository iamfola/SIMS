require('dotenv').config();
const { initDB, run, query } = require('./config/database');

async function main() {
  await initDB();

  run("UPDATE users SET must_change_password = 0 WHERE role IN ('teacher', 'student')");

  const students = query("SELECT id FROM students WHERE email IS NULL OR email = ''");
  for (const s of students) {
    run("UPDATE students SET email = ? WHERE id = ?", ['student' + s.id + '@sims.edu', s.id]);
  }

  const updated = query("SELECT role, COUNT(*) as c FROM users WHERE must_change_password = 0 GROUP BY role");
  console.log('Updated:');
  updated.forEach(r => console.log('  ' + r.role + ': ' + r.c + ' accounts (must_change=0)'));

  const emailed = query("SELECT COUNT(*) as c FROM students WHERE email IS NOT NULL AND email != ''");
  console.log('  students with email: ' + emailed[0].c);

  const { getUserByUsername } = require('./models/db');
  const u = getUserByUsername('student.jss1.a.001');
  console.log('\nstudent.jss1.a.001: must_change=' + u.must_change_password);
}

main().catch(console.error);
