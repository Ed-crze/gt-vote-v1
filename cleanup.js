const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function cleanup() {
  console.log('🧹 Starting cleanup...')
  console.log('This will remove all dummy students and reset all votes.\n')

  // Step 1 — Reset all votes and ballots
  console.log('Step 1/3 — Resetting votes...')

  const { error: ballotsError } = await supabase
    .from('ballots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  const { error: registryError } = await supabase
    .from('voter_registry')
    .update({ has_voted: false, voted_at: null })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (ballotsError) console.error('  ❌ Ballots reset failed:', ballotsError.message)
  else console.log('  ✅ All ballots deleted')

  if (registryError) console.error('  ❌ Registry reset failed:', registryError.message)
  else console.log('  ✅ All voter registry entries reset')

  // Step 2 — Get all dummy student IDs
  console.log('\nStep 2/3 — Finding dummy students...')

  const { data: dummyStudents, error: findError } = await supabase
    .from('students')
    .select('id, email, full_name')
    .like('email', '%@dummy.gctu.edu.gh')

  if (findError) {
    console.error('❌ Could not find dummy students:', findError.message)
    return
  }

  if (!dummyStudents?.length) {
    console.log('  ℹ️  No dummy students found — already clean')
    return
  }

  console.log(`  Found ${dummyStudents.length} dummy students to remove`)

  // Step 3 — Delete each dummy auth user
  // Cascades to students + voter_registry automatically
  console.log('\nStep 3/3 — Removing dummy accounts...')

  let deleted = 0
  let failed = 0

  for (const student of dummyStudents) {
    const { error } = await supabase.auth.admin.deleteUser(student.id)

    if (error) {
      console.error(`  ❌ Failed to delete ${student.email}:`, error.message)
      failed++
    } else {
      deleted++
      console.log(`  ✅ ${deleted}/${dummyStudents.length} — Removed ${student.full_name}`)
    }

    await new Promise(r => setTimeout(r, 100))
  }

  console.log('\n════════════════════════════════')
  console.log(`✅ Accounts removed: ${deleted}`)
  console.log(`❌ Failed:           ${failed}`)
  console.log(`🗳️  Ballots:          All deleted`)
  console.log(`📋 Registry:         All reset`)
  console.log(`👥 Real students:    Untouched`)
  console.log(`🎯 Candidates:       Untouched`)
  console.log(`⚙️  Settings:         Untouched`)
  console.log('════════════════════════════════')
  console.log('\nYour system is clean and ready for the real election.')
}

cleanup()