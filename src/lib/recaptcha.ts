import { z } from "zod";

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || "";

export async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!RECAPTCHA_SECRET) {
    console.warn("reCAPTCHA secret not configured");
    return true;
  }

  try {
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${token}`,
      { method: "POST" }
    );

    const data = await response.json();
    return data.success && data.score > 0.5;
  } catch (error) {
    console.error("reCAPTCHA verification failed:", error);
    return false;
  }
}

export const recaptchaSchema = z.object({
  "g-recaptcha-response": z.string().min(1, "reCAPTCHA verification required"),
});

export type RecaptchaInput = z.infer<typeof recaptchaSchema>;