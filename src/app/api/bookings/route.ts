import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { sendBookingConfirmation } from "@/lib/email";

const bookingSchema = z.object({
  serviceId: z.string(),
  date: z.string(),
  time: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  notes: z.string().optional(),
  recaptchaToken: z.string().min(1, "reCAPTCHA required"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const where: any = {};
    
    if (user?.role === "CUSTOMER") {
      where.userId = user.id;
    }
    
    if (status) {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          service: true,
          branch: true,
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.booking.count({ where }),
    ]);

    return NextResponse.json({
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Please login to book" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = bookingSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { serviceId, date, time, name, email, phone, address, notes, recaptchaToken } = result.data;

    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      return NextResponse.json(
        { error: "reCAPTCHA verification failed" },
        { status: 400 }
      );
    }

    const service = await db.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    const existingBookings = await db.booking.findMany({
      where: {
        serviceId,
        date: new Date(date),
        timeSlot: time,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      },
    });

    if (existingBookings.length > 0) {
      return NextResponse.json(
        { error: "Time slot not available" },
        { status: 409 }
      );
    }

    let branch = await db.branch.findFirst({
      where: { isActive: true },
    });

    if (!branch) {
      branch = await db.branch.create({
        data: {
          name: "Main Office",
          address: "Default Address",
          city: "Default City",
        },
      });
    }

    const booking = await db.booking.create({
      data: {
        userId: user.id,
        serviceId,
        branchId: branch.id,
        date: new Date(date),
        timeSlot: time,
        notes,
        totalPrice: service.price,
      },
      include: {
        user: true,
        service: true,
        branch: true,
      },
    });

    await sendBookingConfirmation(email, booking);

    return NextResponse.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}