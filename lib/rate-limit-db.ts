import { prisma } from './prisma'

export async function checkOtpSendLimit(
  phone: string,
  ip: string
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  const oneHour = new Date(Date.now() - 60 * 60 * 1000)
  const oneMin = new Date(Date.now() - 60 * 1000)
  const phoneSuffix = phone.replace(/\D/g, '').slice(-9)

  const byPhone = await prisma.oTP.count({
    where: {
      user: { phone: { endsWith: phoneSuffix } },
      createdAt: { gte: oneHour },
    },
  })
  if (byPhone >= 3)
    return { allowed: false, reason: 'Too many codes sent to this number. Try again in 1 hour.', retryAfter: 3600 }

  const byIp = await prisma.oTP.count({
    where: {
      metadata: { path: ['ip'], equals: ip },
      createdAt: { gte: oneHour },
    },
  })
  if (byIp >= 5)
    return { allowed: false, reason: 'Too many requests from your device. Try again in 1 hour.', retryAfter: 3600 }

  const recent = await prisma.oTP.findFirst({
    where: {
      user: { phone: { endsWith: phoneSuffix } },
      createdAt: { gte: oneMin },
    },
  })
  if (recent)
    return { allowed: false, reason: 'Please wait 1 minute before requesting another code.', retryAfter: 60 }

  return { allowed: true }
}

export async function checkOtpVerifyLimit(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const otp = await prisma.oTP.findFirst({
    where: { userId, isUsed: false },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) return { allowed: true }
  if (otp.attempts >= 5) {
    await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
    return { allowed: false, reason: 'Too many wrong attempts. Request a new code.' }
  }
  return { allowed: true }
}
