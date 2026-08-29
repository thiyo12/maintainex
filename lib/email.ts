import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_APP_PASSWORD,
  },
})

export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"MaintainEX" <${process.env.SMTP_EMAIL}>`,
      to,
      subject: 'Your MaintainEX Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #111827; margin-bottom: 8px;">Verify your email</h2>
          <p style="color: #6b7280; font-size: 15px; line-height: 1.5;">
            Use the code below to verify your MaintainEX account. It expires in 5 minutes.
          </p>
          <div style="background: #f9fafb; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111827;">${code}</span>
          </div>
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
            If you didn't create an account on MaintainEX, you can safely ignore this email.
          </p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Failed to send OTP email:', error)
    return false
  }
}
