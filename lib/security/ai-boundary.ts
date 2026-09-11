export interface AIBoundaryCheck {
  allowed: boolean
  reason?: string
}

const BLOCKED_AI_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)\s+(?:ai|assistant|bot)/i,
  /act\s+as\s+if\s+you\s+(?:are|have|were)/i,
  /pretend\s+(?:you\s+are|to\s+be|you['']re)/i,
  /roleplay\s+as\s+(?:a|an|the)/i,
  /bypass\s+(?:security|auth|validation|rate)/i,
  /override\s+(?:security|auth|validation)/i,
  /disable\s+(?:security|auth|validation|rate)/i,
  /reveal\s+(?:secret|key|password|token|credential)/i,
  /show\s+(?:me\s+)?(?:the\s+)?(?:secret|key|password|token|credential)/i,
  /what\s+(?:is|are|were)\s+(?:the\s+)?(?:secret|key|password|token|credential)/i,
  /what\s+is\s+.*(?:password|secret|token|key|credential)/i,
  /dump\s+(?:all\s+)?(?:users?|accounts?|passwords?|tokens?|keys?|secrets?)/i,
  /select\s+\*\s+from\s+(?:users?|accounts?|admin)/i,
  /system\s*prompt/i,
  /injection/i,
  /\bdrop\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\bupdate\s+.*\s+set\b/i,
  /<script/i,
  /javascript:/i,
  /on(error|load|click)\s*=/i,
]

const MAX_INPUT_LENGTH = 10000

export function checkAIBoundary(input: string, context?: {
  userAgent?: string
  ip?: string
}): AIBoundaryCheck {
  if (!input || input.length === 0) {
    return { allowed: true }
  }

  if (input.length > MAX_INPUT_LENGTH) {
    return {
      allowed: false,
      reason: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
    }
  }

  for (const pattern of BLOCKED_AI_PATTERNS) {
    if (pattern.test(input)) {
      return {
        allowed: false,
        reason: `Input matches blocked pattern: ${pattern.source.slice(0, 50)}...`,
      }
    }
  }

  const sqlKeywords = /\b(drop\s+table|delete\s+from|update\s+.*\s+set|insert\s+into)\b/i
  if (sqlKeywords.test(input)) {
    return {
      allowed: false,
      reason: 'Input contains SQL manipulation keywords',
    }
  }

  return { allowed: true }
}
