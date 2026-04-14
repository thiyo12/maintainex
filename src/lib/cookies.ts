import { cookies } from "next/headers";

export async function setSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set("session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get("session")?.value;
}