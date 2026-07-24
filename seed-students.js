const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const FACULTIES = [
  'Faculty of Computing and Information Systems',
  'Faculty of IT Business',
  'Faculty of Engineering',
]

const LEVELS = ['Level 100', 'Level 200', 'Level 300', 'Level 400']

const FIRST_NAMES = [
  'Kwame', 'Kofi', 'Kojo', 'Kweku', 'Yaw', 'Kwabena', 'Akosua', 'Abena',
  'Akua', 'Afia', 'Ama', 'Adwoa', 'Yaa', 'Efua', 'Araba', 'Nana',
  'Esi', 'Abiba', 'Adjoa', 'Ekua', 'Kwesi', 'Fiifi', 'Edem', 'Dela',
  'Mawuli', 'Selorm', 'Elinam', 'Sena', 'Kafui', 'Dziedzorm'
]

const LAST_NAMES = [
  'Asante', 'Mensah', 'Boateng', 'Darko', 'Owusu', 'Acheampong', 'Amponsah',
  'Amoako', 'Antwi', 'Opoku', 'Appiah', 'Frimpong', 'Kyei', 'Osei', 'Agyei',
  'Tetteh', 'Quaye', 'Laryea', 'Nartey', 'Ankrah', 'Klah', 'Amprofi',
  'Safo', 'Adom', 'Asiedu', 'Barimah', 'Bonsu', 'Danso', 'Ennin', 'Forson'
]

const TOTAL_STUDENTS = 50
const PASSWORD = 'GtVote@2025'

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateStudentId(index) {
  const base = 4211230300 + index
  return base.toString()
}

function generateName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]
  const last = LAST_NAMES[Math.floor(index / 2) % LAST_NAMES.length]
  return `${first} ${last}`
}

async function seedStudents() {
  console.log('🌱 Starting student seed...')
  console.log(`Creating ${TOTAL_STUDENTS} dummy students across ${FACULTIES.length} faculties\n`)

  let created = 0
  let failed = 0

  for (let i = 0; i < TOTAL_STUDENTS; i++) {
    const studentId = generateStudentId(i)
    const fullName = generateName(i)
    const faculty = FACULTIES[i % FACULTIES.length]
    const level = LEVELS[i % LEVELS.length]
    const email = `${studentId}@dummy.gctu.edu.gh`

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          student_id: studentId,
          full_name: fullName,
          faculty,
          level,
        }
      })

      if (error) {
        // Skip if already exists
        if (error.message?.includes('already been registered')) {
          console.log(`⚠️  Skipped ${email} — already exists`)
        } else {
          console.error(`❌ Failed ${email}:`, error.message)
          failed++
        }
        continue
      }

      created++
      console.log(`✅ ${created}/${TOTAL_STUDENTS} — ${fullName} | ${faculty} | ${email}`)

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))

    } catch (err) {
      console.error(`❌ Error creating ${email}:`, err.message)
      failed++
    }
  }

  console.log('\n════════════════════════════════')
  console.log(`✅ Created: ${created} students`)
  console.log(`❌ Failed:  ${failed} students`)
  console.log(`📧 Password: ${PASSWORD}`)
  console.log(`🏫 Faculties: ${FACULTIES.join(', ')}`)
  console.log('════════════════════════════════')
  console.log('\nRun seed-votes.js next to submit dummy votes.')
}

seedStudents()