require('dotenv').config();
const { initDB } = require('./config/database');
const {
  getAllClasses, createStudentWithUser, createTeacherWithUser,
  generateRegNo
} = require('./models/db');

const PASSWORD = 'test1234';
const STUDENTS_PER_CLASS = 15;

const FIRST_NAMES = [
  'Ade', 'Bola', 'Chioma', 'Dayo', 'Emeka', 'Funke', 'Gbenro', 'Hauwa',
  'Ifeanyi', 'Jumoke', 'Kelechi', 'Lola', 'Musa', 'Ngozi', 'Obinna',
  'Precious', 'Quadri', 'Rahmat', 'Segun', 'Tunde', 'Uchenna', 'Victoria',
  'Wale', 'Yetunde', 'Zainab'
];

const LAST_NAMES = [
  'Adebayo', 'Bello', 'Chukwudi', 'Danjuma', 'Ekwueme', 'Fashina',
  'Garba', 'Hassan', 'Ibrahim', 'Johnson', 'Kazeem', 'Lawal',
  'Mohammed', 'Nwachukwu', 'Okafor', 'Peter', 'Quadri', 'Raji',
  'Suleiman', 'Tijani', 'Ugwu', 'Victor', 'Williams', 'Yusuf', 'Zakari'
];

const AGE_RANGES = {
  'JSS1': [10, 12], 'JSS2': [11, 13], 'JSS3': [12, 14],
  'SS1': [14, 16], 'SS2': [15, 17], 'SS3': [16, 18]
};

function getAge(className) {
  const [min, max] = AGE_RANGES[className] || [11, 15];
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function main() {
  await initDB();
  const classes = getAllClasses();
  console.log(`Found ${classes.length} classes\n`);

  for (const cls of classes) {
    const label = `${cls.name} ${cls.arm}`;
    const key = `${cls.name.toLowerCase()}.${cls.arm.toLowerCase()}`;

    try {
      const tUser = `teacher.${key}`;
      await createTeacherWithUser(tUser, PASSWORD, cls.name, cls.arm, 'Teacher', cls.id);
      console.log(`Teacher: ${tUser} (${label})`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`Teacher already exists for ${label}`);
      } else {
        console.error(`Teacher error for ${label}: ${e.message}`);
      }
    }

    let created = 0;
    for (let i = 0; i < STUDENTS_PER_CLASS; i++) {
      const num = String(i + 1).padStart(3, '0');
      const sUser = `student.${key}.${num}`;
      const fn = FIRST_NAMES[i % FIRST_NAMES.length];
      const ln = LAST_NAMES[i % LAST_NAMES.length];
      try {
        const regNo = await generateRegNo();
        await createStudentWithUser(sUser, PASSWORD, fn, '', ln, getAge(cls.name), cls.id, regNo);
        created++;
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.error(`  Student error ${sUser}: ${e.message}`);
        }
      }
    }
    console.log(`  ${created} students in ${label}\n`);
  }

  const { get } = require('./config/database');
  const total = get('SELECT COUNT(*) as c FROM users').c;
  const students = get('SELECT COUNT(*) as c FROM students').c;
  const teachers = get('SELECT COUNT(*) as c FROM teachers').c;
  console.log(`Total: ${total} users, ${teachers} teachers, ${students} students`);
}

main().catch(console.error);
