import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createOTP, checkSuspiciousLogin, logLoginActivity } from "@/lib/auth";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { sendOTPEmail } from "@/lib/email";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
  recaptchaToken: z.string().min(1, "reCAPTCHA required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, recaptchaToken } = result.data;

    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      return NextResponse.json(
        { error: "reCAPTCHA verification failed" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const suspicious = await checkSuspiciousLogin(user.id, ipAddress, userAgent);
    
    if (suspicious.isSuspicious) {
      await logLoginActivity(
        user.id,
        email,
        ipAddress,
        userAgent,
        true,
        suspicious.reason
      );
    } else {
      await logLoginActivity(
        user.id,
        email,
        ipAddress,
        userAgent,
        false
      );
    }

    const { code } = await createOTP(user.id, "LOGIN");
    await sendOTPEmail(user.email, code, user.name);

    return NextResponse.json({ 
      success: true, 
      message: "OTP sent to email",
      pendingUserId: user.id 
    });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}