import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // never statically cached — these are live counts

// Public landing-page stats. RLS blocks anon reads on every table, and /home renders
// for logged-out visitors, so aggregation happens here with the service-role key.
// Only counts leave this route — never rows, never anything voter-identifying.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Stats unavailable.' }, { status: 500 })
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const [registered, voted, settingsRes, facultyRes] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase
        .from('voter_registry')
        .select('*', { count: 'exact', head: true })
        .eq('has_voted', true),
      supabase
        .from('election_settings')
        .select('is_open, start_time, end_time')
        .eq('id', 1)
        .single(),
      supabase.from('students').select('faculty'),
    ])

    if (registered.error || voted.error || facultyRes.error) {
      return NextResponse.json({ error: 'Stats unavailable.' }, { status: 500 })
    }

    const registeredVoters = registered.count ?? 0
    const votesCast = Math.min(voted.count ?? 0, registeredVoters)
    const turnoutPct =
      registeredVoters > 0
        ? Math.min(Math.round((votesCast / registeredVoters) * 100), 100)
        : 0

    // .single() errors when the settings row is missing — treat that as "not configured"
    const settings = settingsRes.data ?? null
    const startTime = settings?.start_time ?? null
    const endTime = settings?.end_time ?? null
    const timeExpired = endTime ? new Date(endTime).getTime() < Date.now() : false
    const isOpen = Boolean(settings?.is_open) && !timeExpired

    const facultyCounts: Record<string, number> = {}
    let totalWithFaculty = 0
    facultyRes.data?.forEach(s => {
      if (s.faculty) {
        facultyCounts[s.faculty] = (facultyCounts[s.faculty] || 0) + 1
        totalWithFaculty++
      }
    })

    const faculties = Object.entries(facultyCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        // strip the prefix so long GCTU names fit the mobile bar row
        name: name.replace('Faculty of ', ''),
        count,
        pct: totalWithFaculty > 0 ? Math.round((count / totalWithFaculty) * 100) : 0,
      }))

    return NextResponse.json({
      registeredVoters,
      votesCast,
      turnoutPct,
      isOpen,
      startTime,
      endTime,
      faculties,
    })
  } catch {
    return NextResponse.json({ error: 'Stats unavailable.' }, { status: 500 })
  }
}
