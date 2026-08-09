import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createServerSideClient } from '@/lib/supabase/server'

export const runtime = 'nodejs' // nodemailer needs the Node runtime, not edge

export async function POST() {
  try {
    const supabase = await createServerSideClient()

    // Authenticate server-side — email comes from the session, never the client
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Respect the admin toggle
    const { data: settings } = await supabase
      .from('election_settings')
      .select('email_receipts')
      .eq('id', 1)
      .single()

    if (!settings?.email_receipts) {
      return NextResponse.json({ sent: false, reason: 'disabled' })
    }

    const { BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER, BREVO_SMTP_PASS, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } = process.env
    if (!BREVO_SMTP_HOST || !BREVO_SMTP_USER || !BREVO_SMTP_PASS || !BREVO_SENDER_EMAIL) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port: Number(BREVO_SMTP_PORT) || 587,
      secure: false, // 587 uses STARTTLS
      auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
    })

    // Neutral confirmation only — NO receipt code, NO candidate, NO position
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1B2A5E;padding:20px 24px;color:#fff">
          <div style="font-size:18px;font-weight:700">GT<span style="color:#C9A227">-Vote</span></div>
          <div style="font-size:12px;opacity:.7">GCTU SRC Elections 2025 / 2026</div>
        </div>
        <div style="padding:24px;color:#1f2937;line-height:1.6;font-size:14px">
          <p style="margin:0 0 12px">Hello,</p>
          <p style="margin:0 0 12px">
            This is to confirm that <strong>you have voted</strong> in the GCTU SRC Elections.
            Thank you for participating.
          </p>
          <p style="margin:0 0 12px;color:#6b7280;font-size:13px">
            Your vote is completely anonymous. This message confirms your participation only
            and contains no information about your selections.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px">
            If you did <strong>not</strong> cast this vote, contact the Electoral Commission immediately.
          </p>
        </div>
        <div style="background:#f9fafb;padding:14px 24px;color:#9ca3af;font-size:11px;text-align:center">
          GT-Vote — Ghana Communication Technology University
        </div>
      </div>`

    await transporter.sendMail({
      from: `"${BREVO_SENDER_NAME || 'GT-Vote'}" <${BREVO_SENDER_EMAIL}>`,
      to: user.email,
      subject: 'Confirmation: You have voted',
      html,
    })

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('send-vote-confirmation error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
  }
}