import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/** فهرست کدهای جفت‌سازی */
export async function GET() {
  if (!(await isAdminRequest())) return unauthorizedResponse();

  const codes = await db.pairingCode.findMany({ orderBy: { createdAt: "desc" } });
  const devices = await db.device.findMany({ select: { id: true, name: true } });
  const nameMap = new Map(devices.map((d) => [d.id, d.name]));

  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      note: c.note,
      used: c.used,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
      usedAt: c.usedAt,
      deviceName: c.deviceId ? (nameMap.get(c.deviceId) ?? null) : null,
    })),
  });
}

/** ساخت کد جفت‌سازی جدید (۶ رقمی، ۲۴ ساعت اعتبار) */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse();

  let note: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.note === "string" && body.note.trim()) {
      note = body.note.trim().slice(0, 100);
    }
  } catch {
    // بدنه خالی هم قابل قبول است
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await db.pairingCode.findUnique({ where: { code } });
    if (exists) continue;
    const created = await db.pairingCode.create({
      data: {
        code,
        note,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return NextResponse.json({
      code: {
        id: created.id,
        code: created.code,
        note: created.note,
        used: created.used,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
        usedAt: created.usedAt,
        deviceName: null,
      },
    });
  }

  return NextResponse.json(
    { error: "تولید کد ناموفق بود، دوباره تلاش کنید" },
    { status: 500 }
  );
}

/** حذف کد */
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "شناسه کد لازم است" }, { status: 400 });
  }
  // اگر کد وجود نداشته باشد، Prisma خطای P2025 پرتاب می‌کند؛
  // آن را گرفته و به‌صورت 404 پاسخ می‌دهیم.
  try {
    await db.pairingCode.delete({ where: { id } });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "کد پیدا نشد" }, { status: 404 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
