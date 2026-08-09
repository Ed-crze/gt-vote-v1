const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const HASH_SALT = process.env.HASH_SALT || 'gt-vote-2025'
const VOTE_PERCENTAGE = 0.75 // 75% turnout

async function hashStudentId(studentId) {
  const data = HASH_SALT + studentId.toUpperCase().trim()
  return crypto.createHash('sha256').update(data).digest('hex')
}

function weightedRandom(candidates) {
  // Assign realistic weights — first candidate gets more votes
  // Creates a natural spread not a uniform distribution
  const total = candidates.length
  const weights = candidates.map((_, i) => {
    if (i === 0) return 0.42        // Leader gets ~42%
    if (i === 1) return 0.33        // Second gets ~33%
    if (i === 2) return 0.25        // Third gets ~25%
    return Math.max(0.1, 0.3 / i)  // Others get progressively less
  })

  // Normalize weights to sum to 1
  const sum = weights.reduce((a, b) => a + b, 0)
  const normalized = weights.map(w => w / sum)

  // Pick based on weight
  const rand = Math.random()
  let cumulative = 0
  for (let i = 0; i < candidates.length; i++) {
    cumulative += normalized[i]
    if (rand <= cumulative) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

async function seedVotes() {
  console.log('🗳️  Starting vote seed...')

  // Step 1 — Get all dummy students
  const { data: dummyStudents, error: studentsError } = await supabase
    .from('students')
    .select('id, student_id, full_name, faculty, email')
    .like('email', '%@dummy.gctu.edu.gh')

  if (studentsError || !dummyStudents?.length) {
    console.error('❌ No dummy students found. Run seed-students.js first.')
    return
  }

  console.log(`Found ${dummyStudents.length} dummy students`)

  // Step 2 — Get all candidates grouped by position
  const { data: candidateData, error: candError } = await supabase
    .from('candidates')
    .select('id, full_name, position')
    .order('position')

  if (candError || !candidateData?.length) {
    console.error('❌ No candidates found. Add candidates via admin panel first.')
    return
  }

  // Group candidates by position
  const positionMap = {}
  candidateData.forEach(c => {
    if (!positionMap[c.position]) positionMap[c.position] = []
    positionMap[c.position].push(c)
  })

  const positions = Object.keys(positionMap)
  console.log(`Found ${positions.length} positions: ${positions.join(', ')}`)
  console.log(`Found ${candidateData.length} total candidates\n`)

  // Step 3 — Select which students will vote (75%)
  const shuffled = [...dummyStudents].sort(() => Math.random() - 0.5)
  const votersCount = Math.floor(dummyStudents.length * VOTE_PERCENTAGE)
  const voters = shuffled.slice(0, votersCount)

  console.log(`Submitting votes for ${voters.length}/${dummyStudents.length} students (${Math.round(VOTE_PERCENTAGE * 100)}% turnout)\n`)

  let success = 0
  let failed = 0

  // Step 4 — Submit vote for each selected student
  for (const student of voters) {
    try {
      // Build votes array — one candidate per position
      const votes = positions.map(position => {
        const candidates = positionMap[position]
        const chosen = weightedRandom(candidates)
        return {
          candidate_id: chosen.id,
          position: position,
        }
      })

      // Hash the student ID exactly as the app does
      const hash = await hashStudentId(student.student_id)

      // Call submit_vote RPC directly — bypasses is_open check
      const { data: receipt, error } = await supabase.rpc('submit_vote', {
        p_student_id_hash: hash,
        p_votes: votes,
      })

      if (error) {
        if (error.message?.includes('ALREADY_VOTED')) {
          console.log(`⚠️  ${student.full_name} already voted — skipping`)
        } else {
          console.error(`❌ ${student.full_name}:`, error.message)
          failed++
        }
        continue
      }

      success++
      console.log(`✅ ${success}/${voters.length} — ${student.full_name} | ${student.faculty} | Receipt: ${receipt}`)

      // Small delay to avoid overwhelming the database
      await new Promise(r => setTimeout(r, 150))

    } catch (err) {
      console.error(`❌ Error voting for ${student.full_name}:`, err.message)
      failed++
    }
  }

  console.log('\n════════════════════════════════')
  console.log(`✅ Votes submitted: ${success}`)
  console.log(`❌ Failed:          ${failed}`)
  console.log(`📊 Turnout:         ${Math.round((success / dummyStudents.length) * 100)}%`)
  console.log('════════════════════════════════')
  console.log('\nYour dashboard should now show realistic turnout and results.')
  console.log('Run cleanup.js after your presentation to remove all dummy data.')
}

seedVotes()