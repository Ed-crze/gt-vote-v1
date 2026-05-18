import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { secretKey } = await req.json()

    const validKey = process.env.ADMIN_SECRET_KEY

    if (!secretKey || secretKey !== validKey) {
      return NextResponse.json(
        { error: 'Invalid secret key.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch {
    return NextResponse.json(
      { error: 'Server error.' },
      { status: 500 }
    )
  }
}