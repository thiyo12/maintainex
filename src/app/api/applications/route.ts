import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyRecaptcha } from "@/lib/recaptcha";

const applicationSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone required"),
  service: z.string().min(1, "Service required"),
  experience: z.string().min(1, "Experience required"),
  resumeUrl: z.string().url().optional(),
  recaptchaToken: z.string().min(1, "reCAPTCHA required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = applicationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, phone, service, experience, resumeUrl } = result.data;

    const recaptchaValid = await verifyRecaptcha(body.recaptchaToken);
    if (!recaptchaValid) {
      return NextResponse.json(
        { error: "reCAPTCHA verification failed" },
        { status: 400 }
      );
    }

    const existing = await db.application.findFirst({
      where: { email, service },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You've already applied for this position" },
        { status: 409 }
      );
    }

    const application = await db.application.create({
      data: {
        name,
        email,
        phone,
        service,
        experience,
        resumeUrl,
      },
    });

    return NextResponse.json({
      success: true,
      application,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("Application error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const applications = await db.application.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Get applications error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}