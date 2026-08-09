import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createServerSideClient } from '@/lib/supabase/server'
import { hashStudentId } from '@/lib/auth'

export const runtime = 'nodejs' // nodemailer needs the Node runtime, not edge

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gt-vote-v1.vercel.app'

// Shared GT-Vote email shell — navy header, white body, grey footer.
function shell(bodyHtml: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#1B2A5E;padding:20px 24px;color:#fff">
      <div style="font-size:18px;font-weight:700">GT<span style="color:#C9A227">-Vote</span></div>
      <div style="font-size:12px;opacity:.7">GCTU SRC Elections 2025 / 2026</div>
    </div>
    <div style="padding:24px;color:#1f2937;line-height:1.6;font-size:14px">
      ${bodyHtml}
    </div>
    <div style="background:#f9fafb;padding:14px 24px;color:#9ca3af;font-size:11px;text-align:center">
      GT-Vote — Ghana Communication Technology University
    </div>
  </div>`
}

function goldButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#C9A227;color:#1B2A5E;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px">${label} &rarr;</a>`
}

function openingEmail(name: string) {
  return shell(`
    <p style="margin:0 0 12px">Hello ${name || 'Student'},</p>
    <p style="margin:0 0 12px">
      Voting in the <strong>GCTU SRC Elections</strong> is now <strong style="color:#1B2A5E">officially open</strong>.
      Make your voice count — review the candidates and cast your ballot.
    </p>
    <p style="margin:0 0 18px;color:#6b7280;font-size:13px">
      Your vote is completely anonymous and secure.
    </p>
    <p style="margin:0 0 8px">${goldButton(`${SITE_URL}/dashboard`, 'Go to GT-Vote')}</p>
  `)
}

function closingEmail(name: string, deadline: string | null) {
  return shell(`
    <p style="margin:0 0 12px">Hello ${name || 'Student'},</p>
    <p style="margin:0 0 12px">
      Our records show you <strong>have not yet voted</strong> in the GCTU SRC Elections, and
      voting is <strong style="color:#1B2A5E">closing soon</strong>.
    </p>
    ${deadline ? `<p style="margin:0 0 12px">Voting closes at <strong>${deadline}</strong>. Don't miss your chance to be heard.</p>` : ''}
    <p style="margin:0 0 18px;color:#6b7280;font-size:13px">
      It only takes a minute, and your vote is completely anonymous.
    </p>
    <p style="margin:0 0 8px">${goldButton(`${SITE_URL}/ballot`, 'Vote Now')}</p>
  `)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSideClient()

    // Admin-only — same role gate the admin dashboard uses
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type } = await req.json().catch(() => ({})) as { type?: string }
    if (type !== 'opening' && type !== 'closing') {
      return NextResponse.json({ error: 'Invalid reminder type' }, { status: 400 })
    }

    const { BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER, BREVO_SMTP_PASS, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } = process.env
    if (!BREVO_SMTP_HOST || !BREVO_SMTP_USER || !BREVO_SMTP_PASS || !BREVO_SENDER_EMAIL) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    // Pull the deadline for the closing reminder
    const { data: settings } = await supabase
      .from('election_settings')
      .select('end_time')
      .eq('id', 1)
      .single()

    const deadline = settings?.end_time
      ? new Date(settings.end_time).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : null

    // All registered students
    const { data: students, error: studentsErr } = await supabase
      .from('students')
      .select('student_id, full_name, email')

    if (studentsErr) {
      return NextResponse.json({ error: 'Failed to load students' }, { status: 500 })
    }

    let recipients = (students ?? []).filter(s => s.email)

    // For "closing", filter down to non-voters WITHOUT linking to ballots.
    // We only read the participation registry (has_voted), never ballot content.
    if (type === 'closing') {
      const { data: registry } = await supabase
        .from('voter_registry')
        .select('student_id_hash, has_voted')

      const votedHashes = new Set(
        (registry ?? []).filter(r => r.has_voted).map(r => r.student_id_hash)
      )

      const filtered: typeof recipients = []
      for (const s of recipients) {
        const hash = await hashStudentId(s.student_id)
        if (!votedHashes.has(hash)) filtered.push(s) // not voted (or no registry row)
      }
      recipients = filtered
    }

    const transporter = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port: Number(BREVO_SMTP_PORT) || 587,
      secure: false, // 587 uses STARTTLS
      auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
    })

    const from = `"${BREVO_SENDER_NAME || 'GT-Vote'}" <${BREVO_SENDER_EMAIL}>`
    const subject = type === 'opening'
      ? 'Voting is Now Open — GT-Vote'
      : '⏰ Voting Closes Soon — You Haven\'t Voted Yet'

    // Verify the SMTP connection up front so an auth/config failure is
    // reported clearly instead of silently failing every individual send.
    try {
      await transporter.verify()
    } catch (e) {
      console.error('Brevo SMTP verify failed:', e)
      return NextResponse.json(
        { error: `Email server rejected the connection: ${(e as Error).message}` },
        { status: 502 },
      )
    }

    let sent = 0
    let firstError: string | null = null
    // Individual sends keep recipient lists private; light throttle for SMTP limits.
    for (const s of recipients) {
      const html = type === 'opening'
        ? openingEmail(s.full_name)
        : closingEmail(s.full_name, deadline)
      try {
        await transporter.sendMail({ from, to: s.email, subject, html })
        sent++
        if (sent % 20 === 0) await new Promise(r => setTimeout(r, 1000))
      } catch (e) {
        if (!firstError) firstError = (e as Error).message
        console.error('reminder send failed for a recipient:', e)
      }
    }

    return NextResponse.json({ sent, total: recipients.length, type, firstError })
  } catch (err) {
    console.error('send-reminders error:', err)
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 502 })
  }
}
