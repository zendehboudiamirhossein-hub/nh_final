import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDeviceToken } from "@/lib/auth";

/**
 * ثبت‌نام دستگاه جدید با کد جفت‌سازی.
 * بدنه: { pairingCode, name, model, androidVersion, appVersion }
 * خروجی: { deviceId, token }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });
  }

  const pairingCode = String(body?.pairingCode ?? "").trim();
  if (!/^\d{6}$/.test(pairingCode)) {
    return NextResponse.json({ error: "کد جفت‌سازی نامعتبر است" }, { status: 400 });
  }

  const code = await db.pairingCode.findUnique({ where: { code: pairingCode } });
  if (!code || code.used || code.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "کد جفت‌سازی معتبر نیست یا منقضی شده است" },
      { status: 404 }
    );
  }

  const name = String(body?.name ?? "").trim().slice(0, 60) || "دستگاه بدون نام";
  const model = String(body?.model ?? "").trim().slice(0, 100) || null;
  const androidVersion = String(body?.androidVersion ?? "").trim().slice(0, 20) || null;
  const appVersion = String(body?.appVersion ?? "").trim().slice(0, 20) || null;

  const now = new Date();
  const token = generateDeviceToken();

  const device = await db.$transaction(async (tx) => {
    const d = await tx.device.create({
      data: { name, model, androidVersion, appVersion, token, lastSeenAt: now },
    });
    await tx.pairingCode.update({
      where: { code: pairingCode },
      data: { used: true, usedAt: now, deviceId: d.id },
    });
    await tx.eventLog.create({
      data: {
        deviceId: d.id,
        type: "REGISTER",
        message: `دستگاه «${name}» با کد ${pairingCode} متصل شد`,
      },
    });
    return d;
  });

  return NextResponse.json({ deviceId: device.id, token });
}
