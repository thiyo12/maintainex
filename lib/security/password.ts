import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const ROUNDS = 14

function getPepper(): string {
  if (!process.env.PASSWORD_PEPPER) throw new Error('[SECURITY] PASSWORD_PEPPER env var is required')
  return process.env.PASSWORD_PEPPER
}

export async function hashPassword(password: string): Promise<string> {
  const peppered = crypto.createHash('sha256').update(password + getPepper()).digest('hex')
  return bcrypt.hash(peppered, ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const peppered = crypto.createHash('sha256').update(password + getPepper()).digest('hex')
  return bcrypt.compare(peppered, hash)
}

export async function verifyPasswordWithMigration(password: string, hash: string): Promise<{ valid: boolean; needsMigration: boolean }> {
  const peppered = crypto.createHash('sha256').update(password + getPepper()).digest('hex')
  if (await bcrypt.compare(peppered, hash)) {
    return { valid: true, needsMigration: false }
  }
  if (await bcrypt.compare(password, hash)) {
    return { valid: true, needsMigration: true }
  }
  return { valid: false, needsMigration: false }
}

export interface PasswordStrength {
  valid: boolean
  score: number
  errors: string[]
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const errors: string[] = []
  let score = 0

  if (password.length >= 8) score++
  else errors.push('Password must be at least 8 characters')

  if (password.length >= 12) score++

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  else errors.push('Password must contain both uppercase and lowercase letters')

  if (/\d/.test(password)) score++
  else errors.push('Password must contain at least one number')

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++
  else errors.push('Password must contain at least one special character')

  const common = [
    'password', '123456', 'qwerty', 'admin', 'letmein', 'welcome', 'monkey', 'dragon',
    'master', 'abc123', 'football', 'shadow', 'trustno1', 'iloveyou', 'sunshine',
    'princess', 'baseball', 'charlie', 'donald', 'password1', 'password123',
    '1234567', '12345678', '123456789', '1234567890', '12345', '12345678910',
    'passw0rd', 'qwerty123', 'login', 'solo', 'passpass', '1q2w3e4r', 'qwertyuiop',
    'ashley', 'michael', 'mustang', 'access', 'whatever', 'hello', 'ranger',
    'buster', 'thomas', 'hunter', 'soccer', 'harley', 'batman', 'andrew',
    'tigger', 'robert', 'love', 'matrix', 'killer', 'jennifer', 'pepper',
    'zxcvbnm', 'summer', 'winter', 'spring', 'autumn', 'computer', 'internet',
    'secret', 'service', 'jessica', 'summer01', 'winter01', 'baseball1',
    'starwars', 'hockey', 'george', 'falcon', 'eagle1', 'thunder', 'hammer',
    'joshua', 'matthew', 'robert', 'daniel', 'james', 'andrew', 'william',
    'jordan', 'justin', 'nathan', 'anthony', 'brian', 'kevin', 'tyler',
    'joseph', 'ryan', 'charles', 'benjamin', 'patrick', 'logan', 'alexander',
    'jackson', 'sebastian', 'owen', 'elijah', 'mason', 'ethan', 'lucas',
    'aiden', 'connor', 'isaac', 'louis', 'samuel', 'henry', 'owen',
    'aaron', 'carlos', 'diego', 'oscar', 'ivan', 'xavier', 'pablo',
    'chang', 'rachel', 'nicole', 'heather', 'amanda', 'jessica', 'brittany',
    '1234', 'test', 'test123', 'changeme', 'default', 'guest', 'root',
    'pass', 'pass1', 'pass12', 'pass123', 'qwerty1', 'qwerty12', 'abc',
    'abcdef', 'abcdefg', 'abc12', 'abc1234', 'trustno', 'secret1',
  ]
  if (common.some(c => password.toLowerCase().includes(c))) {
    errors.push('Password is too common')
    score = 0
  }

  return { valid: errors.length === 0 && score >= 3, score, errors }
}

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
