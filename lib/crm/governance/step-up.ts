import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import type { CrmActionId } from './types'

const STEP_UP_PURPOSE = 'crm_step_up'
const STEP_UP_ISSUER = 'maintainex'
const STEP_UP_AUDIENCE = 'maintainex-crm'
const STEP_UP_TTL_SECONDS = 5 * 60
const VERIFIED_STEP_UP = Symbol('verified-crm-step-up')

export type VerifiedCrmStepUp = {
  readonly [VERIFIED_STEP_UP]: true
}

interface StepUpTokenPayload {
  sub: string
  sid: string
  jti: string
  actionId: CrmActionId
  purpose: typeof STEP_UP_PURPOSE
}

function getStepUpSigningSecret(): string {
  const base = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  if (!base) {
    throw new Error('[SECURITY] JWT_SECRET or NEXTAUTH_SECRET is required for CRM step-up')
  }

  return crypto
    .createHash('sha256')
    .update(`${base}:crm-step-up:v1`)
    .digest('hex')
}

export function crmStepUpExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + STEP_UP_TTL_SECONDS * 1000)
}

export function signCrmStepUpToken(input: {
  grantId: string
  adminUserId: string
  sessionId: string
  actionId: CrmActionId
}): string {
  return jwt.sign(
    {
      sub: input.adminUserId,
      sid: input.sessionId,
      jti: input.grantId,
      actionId: input.actionId,
      purpose: STEP_UP_PURPOSE,
    } satisfies StepUpTokenPayload,
    getStepUpSigningSecret(),
    {
      algorithm: 'HS256',
      expiresIn: STEP_UP_TTL_SECONDS,
      issuer: STEP_UP_ISSUER,
      audience: STEP_UP_AUDIENCE,
    }
  )
}

function verifyToken(token: string): StepUpTokenPayload | null {
  try {
    const payload = jwt.verify(token, getStepUpSigningSecret(), {
      algorithms: ['HS256'],
      issuer: STEP_UP_ISSUER,
      audience: STEP_UP_AUDIENCE,
    }) as StepUpTokenPayload

    if (
      payload.purpose !== STEP_UP_PURPOSE ||
      !payload.sub ||
      !payload.sid ||
      !payload.jti ||
      !payload.actionId
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export async function consumeCrmStepUpProof(input: {
  token: string
  adminUserId: string
  sessionId: string
  actionId: CrmActionId
  now?: Date
}): Promise<VerifiedCrmStepUp | null> {
  const payload = verifyToken(input.token)
  if (!payload) return null

  if (
    payload.sub !== input.adminUserId ||
    payload.sid !== input.sessionId ||
    payload.actionId !== input.actionId
  ) {
    return null
  }

  const now = input.now || new Date()
  const consumed = await prisma.crmStepUpGrant.updateMany({
    where: {
      id: payload.jti,
      adminUserId: input.adminUserId,
      sessionId: input.sessionId,
      actionId: input.actionId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  })

  if (consumed.count !== 1) return null
  return { [VERIFIED_STEP_UP]: true }
}

export function isVerifiedCrmStepUp(value: unknown): value is VerifiedCrmStepUp {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as Record<PropertyKey, unknown>)[VERIFIED_STEP_UP] === true
  )
}
