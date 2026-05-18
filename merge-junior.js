require('dotenv').config();
const { initDB, get, run, query } = require('./config/database');
const { getAllClasses } = require('./models/db');

async function main() {
  await initDB();
  const classes = getAllClasses();

  for (const level of ['JSS1', 'JSS2', 'JSS3']) {
    const arms = classes.filter(c => c.name === level);
    const primary = arms.find(c => c.arm === 'A');
    const others = arms.filter(c => c.arm !== 'A');

    if (!primary || others.length === 0) {
      console.log(`${level}: already merged, skipping`);
      continue;
    }

    console.log(`\n=== ${level} ===`);
    console.log(`Primary: id=${primary.id} arm=${primary.arm}`);
    console.log(`Merging: ${others.map(c => `${c.arm}(id=${c.id})`).join(', ')}`);

    for (const cls of others) {
      // Move students
      const students = query('SELECT id, reg_no FROM students WHERE class_id = ?', [cls.id]);
      console.log(`  Students: moving ${students.length} from ${level} ${cls.arm}`);

      const existingRegNos = query('SELECT reg_no FROM students WHERE class_id = ?', [primary.id]).map(r => r.reg_no);
      let renumber = 0;

      for (const s of students) {
        run('UPDATE students SET class_id = ? WHERE id = ?', [primary.id, s.id]);

        if (existingRegNos.includes(s.reg_no)) {
          const newNum = String(query('SELECT COUNT(*) as c FROM students WHERE class_id = ?', [primary.id])[0].c).padStart(3, '0');
          const newReg = `${level}/${newNum}`;
          run("UPDATE students SET reg_no = ? WHERE id = ?", [newReg, s.id]);
          renumber++;
        } else {
          existingRegNos.push(s.reg_no);
        }
      }
      if (renumber > 0) console.log(`    Renumbered ${renumber} students due to conflicts`);

      // Move subject assignments (dedup by subject_id)
      const subjects = query('SELECT * FROM class_subjects WHERE class_id = ?', [cls.id]);
      let moved = 0;
      for (const subj of subjects) {
        const exists = get('SELECT id FROM class_subjects WHERE class_id = ? AND subject_id = ?',
          [primary.id, subj.subject_id]);
        if (!exists) {
          run('INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?, ?, ?)',
            [primary.id, subj.subject_id, subj.teacher_id]);
          moved++;
        }
      }
      console.log(`  Subjects: moved ${moved}, skipped ${subjects.length - moved} duplicates`);

      // Move teachers
      const teachers = query('SELECT id, first_name, last_name FROM teachers WHERE class_id = ?', [cls.id]);
      for (const t of teachers) {
        run('UPDATE teachers SET class_id = ? WHERE id = ?', [primary.id, t.id]);
      }
      console.log(`  Teachers: reassigned ${teachers.length}`);

      // Delete the class
      run('DELETE FROM classes WHERE id = ?', [cls.id]);
      console.log(`  Deleted ${level} ${cls.arm}`);
    }

    // Clear the arm on the primary class since it's now the unified class
    run("UPDATE classes SET arm = '' WHERE id = ?", [primary.id]);
    console.log(`  Updated primary arm to '' (unified)`);
  }

  console.log('\n=== Summary ===');
  const final = getAllClasses();
  console.log(`Classes now: ${final.length}`);
  final.forEach(c => console.log(`  id=${c.id} "${c.name}" arm="${c.arm}"`));
}

main().catch(console.error);
