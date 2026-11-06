import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SECRET =
  process.env.SESSION_SECRET || "negahban-dev-secret-change-me-in-production";

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
export const SESSION_COOKIE = "negahban_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // یک هفته

function hmac(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  return `${exp}.${hmac(String(exp))}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = hmac(expStr);
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** آیا درخواست فعلی با کوکی نشست ادمین معتبر است؟ */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
}

/** توکن تصادفی برای دستگاه‌ها */
export function generateDeviceToken(): string {
  return crypto.randomBytes(24).toString("hex");
}
