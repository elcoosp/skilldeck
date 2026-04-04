import { NextResponse } from 'next/server'

// In-memory waitlist store (for demo purposes)
const waitlistEmails = new Set<string>()
let waitlistCount = 2847

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body as { email: string }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required.' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const lowerEmail = email.toLowerCase()
    const isDuplicate = waitlistEmails.has(lowerEmail)

    if (!isDuplicate) {
      waitlistEmails.add(lowerEmail)
      waitlistCount += 1
    }

    return NextResponse.json({
      success: true,
      message: isDuplicate
        ? "You're already on the list! We'll keep you updated."
        : "You're on the list! We'll notify you when SkillDeck launches.",
      count: waitlistCount,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    count: waitlistCount,
  })
}
