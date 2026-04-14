import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyOTPAttempt, createSession, getCurrentUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: "Valid 6-digit code required" },
        { status: 400 }
      );
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Session expired. Please login again" },
        { status: 401 }
      );
    }

    const { valid, attempts, locked } = await verifyOTPAttempt(currentUser.id, code);

    if (locked) {
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code" },
        { status: 429 }
      );
    }

    if (!valid) {
      return NextResponse.json(
        { error: `Invalid code. ${5 - attempts} attempts remaining` },
        { status: 401 }
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const session = await createSession(currentUser.id, ipAddress, userAgent);
    await setSessionCookie(session.id);

    return NextResponse.json({ 
      success: true, 
      message: "Login successful",
      user: { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role }
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}