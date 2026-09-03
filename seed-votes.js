const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// submit_vote() derives the voter from auth.uid(), so votes can no longer be
// cast with the service role — each dummy student has to sign in for real.
// The service-role client is still used for the read-only setup queries
// (listing dummy students and candidates), which RLS would otherwise block.
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'GtVote@2025' // shared dummy-account password from seed-students.js
const VOTE_PERCENTAGE = 0.75   // 75% turnout
const DELAY_MS = 250           // between students — sign-in is rate-limited

function weightedRandom(candidates) {
  // Assign realistic weights — first candidate gets more votes
  // Creates a natural spread not a uniform distribution
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

// submit_vote() raises ELECTION_CLOSED unless is_open is true AND now() is
// inside the start/end window. Check up front rather than burning 40 sign-ins
// discovering it one failure at a time.
async function checkElectionOpen() {
  const { data: settings, error } = await admin
    .from('election_settings')
    .select('is_open, start_time, end_time')
    .eq('id', 1)
    .single()

  if (error || !settings) {
    console.warn('⚠️  Could not read election_settings — continuing anyway.')
    return true
  }

  const now = Date.now()
  const started = !settings.start_time || new Date(settings.start_time).getTime() <= now
  const ended = settings.end_time && new Date(settings.end_time).getTime() < now
  const open = !!settings.is_open && started && !ended

  if (!open) {
    console.error('\n════════════════════════════════')
    console.error('❌ VOTING IS NOT OPEN — submit_vote() will raise ELECTION_CLOSED.')
    console.error('════════════════════════════════')
    console.error(`   is_open:    ${settings.is_open}`)
    console.error(`   start_time: ${settings.start_time ?? '(none)'}${started ? '' : '  ← has not started yet'}`)
    console.error(`   end_time:   ${settings.end_time ?? '(none)'}${ended ? '  ← already passed' : ''}`)
    console.error('\nOpen voting in the admin settings page (or set is_open = true and a')
    console.error('start/end window that covers now), then run this script again.\n')
  }

  return open
}

async function voteAsStudent(student, positionMap, positions) {
  // A fresh anon client per student — no shared session state between them.
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: student.email,
      password: PASSWORD,
    })

    if (signInError) {
      return { ok: false, reason: `sign-in failed: ${signInError.message}` }
    }

    // One candidate per position. Position is derived server-side from the
    // candidate now, so only candidate_id is sent.
    const votes = positions.map(position => ({
      candidate_id: weightedRandom(positionMap[position]).id,
    }))

    const { data: receipt, error } = await supabase.rpc('submit_vote', {
      p_votes: votes,
    })

    if (error) return { ok: false, reason: error.message }

    return { ok: true, receipt }
  } finally {
    await supabase.auth.signOut().catch(() => {})
  }
}

async function seedVotes() {
  console.log('🗳️  Starting vote seed...')

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('❌ Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local')
    return
  }

  // Step 0 — voting must be open or every submission fails
  if (!(await checkElectionOpen())) return

  // Step 1 — Get all dummy students
  const { data: dummyStudents, error: studentsError } = await admin
    .from('students')
    .select('id, student_id, full_name, faculty, email')
    .like('email', '%@dummy.gctu.edu.gh')

  if (studentsError || !dummyStudents?.length) {
    console.error('❌ No dummy students found. Run seed-students.js first.')
    return
  }

  console.log(`Found ${dummyStudents.length} dummy students`)

  // Step 2 — Get all candidates grouped by position
  const { data: candidateData, error: candError } = await admin
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

  console.log(`Submitting votes for ${voters.length}/${dummyStudents.length} students (${Math.round(VOTE_PERCENTAGE * 100)}% turnout)`)
  console.log('Each student signs in with the anon key — submit_vote needs auth.uid().\n')

  let success = 0
  let skipped = 0
  let failed = 0

  // Step 4 — Sign in as each selected student and submit their ballot
  for (const student of voters) {
    try {
      const result = await voteAsStudent(student, positionMap, positions)

      if (!result.ok) {
        if (result.reason.includes('ALREADY_VOTED_OR_NOT_REGISTERED')) {
          console.log(`⚠️  ${student.full_name} already voted (or is not registered) — skipping`)
          skipped++
        } else if (result.reason.includes('ELECTION_CLOSED')) {
          console.error('\n❌ Voting closed mid-run — stopping.')
          break
        } else {
          console.error(`❌ ${student.full_name}: ${result.reason}`)
          failed++
        }
      } else {
        success++
        console.log(`✅ ${success}/${voters.length} — ${student.full_name} | ${student.faculty} | Receipt: ${result.receipt}`)
      }

      // Small delay — back-to-back sign-ins hit Supabase auth rate limits
      await new Promise(r => setTimeout(r, DELAY_MS))

    } catch (err) {
      console.error(`❌ Error voting for ${student.full_name}:`, err.message)
      failed++
    }
  }

  console.log('\n════════════════════════════════')
  console.log(`✅ Votes submitted: ${success}`)
  console.log(`⚠️  Skipped:         ${skipped}`)
  console.log(`❌ Failed:          ${failed}`)
  console.log(`📊 Turnout:         ${Math.round((success / dummyStudents.length) * 100)}%`)
  console.log('════════════════════════════════')
  console.log('\nYour dashboard should now show realistic turnout and results.')
  console.log('Run cleanup.js after your presentation to remove all dummy data.')
}

seedVotes()
