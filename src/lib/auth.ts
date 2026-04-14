import crypto from "crypto";
import { db } from "./db";
import { cookies } from "next/headers";

const SESSION_DURATION = 24 * 60 * 60 * 1000;
const OTP_EXPIRY = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashed = hashPassword(password);
  return hashed === hash;
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOTP(otp: string): string {
  return hashPassword(otp);
}

export async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  return hashPassword(otp) === hash;
}

export async function createSession(userId: string, ipAddress: string, userAgent: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  const session = await db.session.create({
    data: {
      userId,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });

  return session;
}

export async function invalidateSession(sessionId: string) {
  await db.session.update({
    where: { id: sessionId },
    data: { isValid: false },
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;

  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || !session.isValid || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return session.user;
}

export async function createOTP(userId: string, purpose: string = "LOGIN") {
  const code = generateOTP();
  const codeHash = await hashOTP(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY);

  const otp = await db.oTP.create({
    data: {
      userId,
      codeHash,
      purpose,
      expiresAt,
    },
  });

  return { otp, code };
}

export async function verifyOTPAttempt(userId: string, inputCode: string): Promise<{ valid: boolean; attempts: number; locked: boolean }> {
  const otp = await db.oTP.findFirst({
    where: {
      userId,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { valid: false, attempts: 0, locked: true };
  }

  const isValid = await verifyOTP(inputCode, otp.codeHash);

  await db.oTP.update({
    where: { id: otp.id },
    data: { attempts: otp.attempts + 1 },
  });

  if (isValid) {
    await db.oTP.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });
  }

  const locked = otp.attempts + 1 >= MAX_OTP_ATTEMPTS;

  return { valid: isValid, attempts: otp.attempts + 1, locked };
}

export async function checkSuspiciousLogin(
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<{ isSuspicious: boolean; isNewIP: boolean; isNewDevice: boolean; reason?: string }> {
  const pastLogins = await db.loginActivity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const hasUsedIP = pastLogins.some((login) => login.ipAddress === ipAddress);
  const hasUsedDevice = pastLogins.some((login) => login.userAgent === userAgent);

  const isNewIP = !hasUsedIP && pastLogins.length > 0;
  const isNewDevice = !hasUsedDevice && pastLogins.length > 0;

  const isSuspicious = isNewIP || isNewDevice || pastLogins.length >= 3;

  let reason: string | undefined;
  if (isNewIP) reason = "New IP address detected";
  if (isNewDevice) reason = "New device detected";

  return { isSuspicious, isNewIP, isNewDevice, reason };
}

export async function logLoginActivity(
  userId: string | null,
  email: string,
  ipAddress: string,
  userAgent: string,
  isSuspicious: boolean,
  reason?: string
) {
  await db.loginActivity.create({
    data: {
      userId,
      email,
      ipAddress,
      userAgent,
      isNewIP: false,
      isNewDevice: false,
      isSuspicious,
      reason,
    },
  });
}