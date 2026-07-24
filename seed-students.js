const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Manually read .env.local since Next.js uses its own env loader
const envPath = path.join(__dirname, '.env.local')
const envFile = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '') // strip BOM if present

envFile.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eqIndex = trimmed.indexOf('=')
  if (eqIndex === -1) return
  const key = trimmed.slice(0, eqIndex).trim()
  let value = trimmed.slice(eqIndex + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  if (!process.env[key]) process.env[key] = value
})

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

function generateStudentId(index) {
  const base = 4211230300 + index
  return base.toString()
}

function generateName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]
  const last = LAST_NAMES[Math.floor(index / 2) % LAST_NAMES.length]
  return `${first} ${last}`
}

// ⚠️ IMPORTANT: this must match whatever hashing logic your actual signup
// flow uses to populate student_id_hash elsewhere in your app (same
// algorithm, same salt/pepper if any). Find that logic in your codebase
// and replace this function's body if it differs.
function hashStudentId(studentId) {
  return crypto.createHash('sha256').update(studentId).digest('hex')
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
    const studentIdHash = hashStudentId(studentId)

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
          student_id_hash: studentIdHash,
        }
      })

      if (error) {
        if (error.message?.includes('already been registered')) {
          console.log(`⚠️  Skipped ${email} — already exists`)
        } else {
          console.error(`❌ Failed ${email}:`, JSON.stringify(error, null, 2))
          failed++
        }
        continue
      }

      created++
      console.log(`✅ ${created}/${TOTAL_STUDENTS} — ${fullName} | ${faculty} | ${email}`)

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