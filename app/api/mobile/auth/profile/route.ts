import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

const NAME_CHANGE_DAYS = 30
const ALLOWED_GENDERS = ['MALE', 'FEMALE', 'OTHER']
const ALLOWED_LANGUAGES = ['EN', 'TA', 'SI']

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const {
      name,
      phone,
      profileImage,
      birthday,
      gender,
      language,
      emergencyContact,
    } = await request.json()

    if (phone !== undefined && phone !== user.phone) {
      return NextResponse.json(
        { error: 'Mobile number changes require OTP verification.' },
        { status: 400 }
      )
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name must be non-empty text' }, { status: 400 })
      }
      if (user.identityStatus === 'VERIFIED' && name.trim() !== user.name) {
        return NextResponse.json(
          { error: 'Name is locked after identity verification. Use your verified name.' },
          { status: 400 }
        )
      }
    }

    if (name !== undefined && name !== user.name) {
      if (user.lastNameChangedAt) {
        const daysSinceChange = Math.floor(
          (Date.now() - new Date(user.lastNameChangedAt).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceChange < NAME_CHANGE_DAYS) {
          const availableAt = new Date(user.lastNameChangedAt)
          availableAt.setDate(availableAt.getDate() + NAME_CHANGE_DAYS)
          return NextResponse.json({
            error: `Name can only be changed every ${NAME_CHANGE_DAYS} days. Available on ${availableAt.toISOString().split('T')[0]}.`,
            availableAt: availableAt.toISOString(),
          }, { status: 429 })
        }
      }
    }

    if (gender !== undefined && !ALLOWED_GENDERS.includes(gender)) {
      return NextResponse.json({ error: 'Invalid gender' }, { status: 400 })
    }
    if (language !== undefined && !ALLOWED_LANGUAGES.includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    if (profileImage !== undefined && profileImage !== null && typeof profileImage !== 'string') {
      return NextResponse.json({ error: 'profileImage must be a URL string' }, { status: 400 })
    }
    if (emergencyContact !== undefined && emergencyContact !== null && typeof emergencyContact !== 'string') {
      return NextResponse.json({ error: 'emergencyContact must be text' }, { status: 400 })
    }

    let normalizedBirthday: Date | null | undefined
    if (birthday !== undefined) {
      if (birthday === null || birthday === '') {
        normalizedBirthday = null
      } else if (typeof birthday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
        return NextResponse.json({ error: 'birthday must use YYYY-MM-DD' }, { status: 400 })
      } else {
        const parsedBirthday = new Date(`${birthday}T00:00:00.000Z`)
        if (Number.isNaN(parsedBirthday.getTime()) || parsedBirthday >= new Date()) {
          return NextResponse.json({ error: 'Enter a valid birthday' }, { status: 400 })
        }
        normalizedBirthday = parsedBirthday
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim().slice(0, 150)
    if (name !== undefined && name !== user.name) updateData.lastNameChangedAt = new Date()

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true, email: true, name: true, phone: true, phoneVerified: true,
        role: true, isActive: true, createdAt: true, lastNameChangedAt: true,
      },
    })

    let profileFields: Record<string, any> | null = null
    if (user.role === 'CUSTOMER') {
      const customerData: any = {}
      if (profileImage !== undefined) {
        customerData.profileImage = typeof profileImage === 'string'
          ? profileImage.trim().slice(0, 2000)
          : null
      }
      if (birthday !== undefined) customerData.birthday = normalizedBirthday
      if (gender !== undefined) customerData.gender = gender
      if (language !== undefined) customerData.language = language
      if (emergencyContact !== undefined) {
        customerData.emergencyContact = typeof emergencyContact === 'string'
          ? emergencyContact.trim().slice(0, 300)
          : null
      }

      if (Object.keys(customerData).length > 0) {
        const existing = await prisma.customerProfile.findUnique({ where: { userId: user.id } })
        if (existing) {
          const profile = await prisma.customerProfile.update({
            where: { userId: user.id },
            data: customerData,
            select: { profileImage: true, birthday: true, gender: true, language: true, emergencyContact: true },
          })
          profileFields = {
            ...profile,
            birthday: profile.birthday ? profile.birthday.toISOString().split('T')[0] : null,
          }
        } else {
          const profile = await prisma.customerProfile.create({
            data: { userId: user.id, ...customerData },
            select: { profileImage: true, birthday: true, gender: true, language: true, emergencyContact: true },
          })
          profileFields = {
            ...profile,
            birthday: profile.birthday ? profile.birthday.toISOString().split('T')[0] : null,
          }
        }
      }
    }

    return NextResponse.json({
      user: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        lastNameChangedAt: updated.lastNameChangedAt?.toISOString() || null,
        ...(profileFields || {}),
      },
    })
  } catch (error) {
    logger.error('Mobile profile update failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}