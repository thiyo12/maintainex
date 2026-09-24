import type { Prisma, PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

export interface JobLifecycleAuditInput {
  jobId: string
  actorId?: string | null
  actorType: string
  action: string
  fromState?: string | null
  toState?: string | null
  metadata?: Record<string, unknown>
}

function serializeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null
  return JSON.stringify(metadata, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )
}

export async function recordJobLifecycleEvent(
  db: DbClient,
  input: JobLifecycleAuditInput
) {
  return db.jobLifecycleEvent.create({
    data: {
      jobId: input.jobId,
      actorId: input.actorId ?? null,
      actorType: input.actorType,
      action: input.action,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      metadata: serializeMetadata(input.metadata),
    },
  })
}
