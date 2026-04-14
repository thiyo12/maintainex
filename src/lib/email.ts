import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER) {
    console.log("Email (dev mode):", { to, subject, html });
    return { success: true };
  }

  const info = await transporter.sendMail({
    from: `"MaintainEx" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });

  return { success: true, messageId: info.messageId };
}

export async function sendOTPEmail(email: string, otp: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #F3F4F6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="background-color: #1F2937; padding: 30px; text-align: center;">
                  <h1 style="color: #FFC300; margin: 0; font-size: 28px;">MaintainEx</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 24px;">Verify your login</h2>
                  <p style="color: #6B7280; margin: 0 0 30px 0; font-size: 16px; line-height: 1.5;">
                    Hi ${name},<br><br>
                    Your verification code is:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px; background-color: #F3F4F6; border-radius: 8px;">
                        <span style="font-size: 36px; font-weight: bold; color: #1F2937; letter-spacing: 8px;">${otp}</span>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #6B7280; margin: 30px 0 0 0; font-size: 14px; line-height: 1.5;">
                    This code expires in 5 minutes.<br>
                    If you didn't request this, please ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #F9FAFB; padding: 20px; text-align: center;">
                  <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                    © 2024 MaintainEx. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail(email, "Your MaintainEx verification code", html);
}

export async function sendBookingConfirmation(email: string, booking: any) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #F3F4F6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="background-color: #1F2937; padding: 30px; text-align: center;">
                  <h1 style="color: #FFC300; margin: 0; font-size: 28px;">MaintainEx</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 24px;">Booking Confirmed!</h2>
                  <p style="color: #6B7280; margin: 0 0 20px 0; font-size: 16px;">
                    Your booking has been confirmed. Here are the details:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6; border-radius: 8px;">
                    <tr>
                      <td style="padding: 15px; color: #1F2937; font-weight: 600;">Service</td>
                      <td style="padding: 15px; color: #374151;">${booking.service.name}</td>
                    </tr>
                    <tr style="border-top: 1px solid #E5E7EB;">
                      <td style="padding: 15px; color: #1F2937; font-weight: 600;">Date</td>
                      <td style="padding: 15px; color: #374151;">${new Date(booking.date).toLocaleDateString()}</td>
                    </tr>
                    <tr style="border-top: 1px solid #E5E7EB;">
                      <td style="padding: 15px; color: #1F2937; font-weight: 600;">Time</td>
                      <td style="padding: 15px; color: #374151;">${booking.timeSlot}</td>
                    </tr>
                    <tr style="border-top: 1px solid #E5E7EB;">
                      <td style="padding: 15px; color: #1F2937; font-weight: 600;">Total</td>
                      <td style="padding: 15px; color: #374151;">$${booking.totalPrice}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color: #F9FAFB; padding: 20px; text-align: center;">
                  <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                    © 2024 MaintainEx. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail(email, "Your MaintainEx Booking Confirmation", html);
}

export async function sendSuspiciousAlert(admins: string[], login: any) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 20px; background-color: #FEE2E2;">
      <h2 style="color: #DC2626;">🚨 Suspicious Login Alert</h2>
      <p><strong>Email:</strong> ${login.email}</p>
      <p><strong>IP:</strong> ${login.ipAddress}</p>
      <p><strong>Device:</strong> ${login.userAgent}</p>
      <p><strong>Reason:</strong> ${login.reason || "Multiple failed attempts"}</p>
    </body>
    </html>
  `;

  for (const admin of admins) {
    await sendEmail(admin, "🚨 Suspicious Login Alert - MaintainEx", html);
  }
}