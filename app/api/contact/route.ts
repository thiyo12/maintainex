import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, subject, message } = body

    if (!name || !phone || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Please fill in all required fields' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    console.log('New Contact Form Submission:')
    console.log('Name:', name)
    console.log('Phone:', phone)
    console.log('Email:', email)
    console.log('Subject:', subject)
    console.log('Message:', message)
    console.log('---')

    return NextResponse.json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.'
    }, { status: 201 })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to process your request. Please try again.' },
      { status: 500 }
    )
  }
}
