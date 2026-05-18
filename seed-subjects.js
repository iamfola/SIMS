require('dotenv').config();
const { initDB } = require('./config/database');
const {
  getAllClasses, getAllSubjects, getAllTeachers,
  assignClassSubject, createSubject
} = require('./models/db');

const SUBJECTS = {
  junior: [
    'Mathematics', 'English Language', 'Basic Science', 'Basic Technology',
    'Social Studies', 'Civic Education', 'Agricultural Science', 'Computer Studies',
    'Business Studies', 'Yoruba', 'French', 'Physical & Health Education',
  ],
  science: [
    'Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology',
    'Further Mathematics', 'Geography', 'Data Processing', 'Civic Education', 'Yoruba',
  ],
  art: [
    'Mathematics', 'English Language', 'Literature in English', 'Government',
    'History', 'Economics', 'Civic Education', 'Yoruba', 'French',
    'Christian Religious Studies',
  ],
  commercial: [
    'Mathematics', 'English Language', 'Economics', 'Financial Accounting',
    'Commerce', 'Business Studies', 'Data Processing', 'Geography',
    'Civic Education', 'Yoruba',
  ],
};

async function main() {
  await initDB();

  const classes = getAllClasses();
  const existingSubjects = getAllSubjects();
  const teachers = getAllTeachers();
  const existingNames = existingSubjects.map(s => s.name);

  const allNeeded = [...new Set(Object.values(SUBJECTS).flat())];

  for (const name of allNeeded) {
    if (!existingNames.includes(name)) {
      createSubject(name);
      console.log(`+ Subject: ${name}`);
    }
  }

  const subjects = getAllSubjects();
  const subjectById = {};
  subjects.forEach(s => { subjectById[s.name] = s.id; });

  const teacherByClass = {};
  teachers.forEach(t => {
    if (t.class_id) teacherByClass[t.class_id] = t.id;
  });

  console.log('');
  for (const cls of classes) {
    let list;
    if (['JSS1', 'JSS2', 'JSS3'].includes(cls.name)) {
      list = SUBJECTS.junior;
    } else if (cls.arm === 'A') {
      list = SUBJECTS.science;
    } else if (cls.arm === 'B') {
      list = SUBJECTS.art;
    } else {
      list = SUBJECTS.commercial;
    }

    const label = `${cls.name} ${cls.arm}`;
    const teacherId = teacherByClass[cls.id] || null;
    let count = 0;

    for (const name of list) {
      const subjectId = subjectById[name];
      if (!subjectId) {
        console.error(`  ! Subject "${name}" not found in DB`);
        continue;
      }
      try {
        assignClassSubject(cls.id, subjectId, teacherId);
        count++;
      } catch (e) {
        if (!e.message.includes('UNIQUE')) {
          console.error(`  Error ${name} -> ${label}: ${e.message}`);
        }
      }
    }
    console.log(`  ${String(count).padStart(2)} subjects -> ${label}`);
  }

  console.log('\nDone! Subject assignments complete.');
}

main().catch(console.error);
