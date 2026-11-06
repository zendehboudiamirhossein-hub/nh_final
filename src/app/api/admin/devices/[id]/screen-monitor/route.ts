import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * روشن/خاموش کردن پایش صفحه (گرفتن اسکرین‌شات هر ۱۰ ثانیه).
 * بدنه: { enabled: boolean }
 * پاسخ: { ok, enabled, startedAt }
 *
 * وقتی روشن می‌شود، در همگام‌سازی بعدی دستگاه (حدود ۱۵ دقیقه، یا
 * بلافاصله اگر کاربر «ارسال فوری گزارش» را بزند) سرویس پایش روی گوشی
 * شروع به کار می‌کند و هر ۱۰ ثانیه یک اسکرین‌شات می‌فرستد.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // بدنه‌ی خالی هم قابل قبول است (در این صورت فقط وضعیت فعلی را برمی‌گردانیم)
  }

  const enabled =
    typeof body?.enabled === "boolean" ? body.enabled : null;
  if (enabled === null) {
    return NextResponse.json(
      { error: "بدنه‌ی { enabled: true|false } لازم است" },
      { status: 400 }
    );
  }

  const device = await db.device.findUnique({
    where: { id },
    select: { id: true, name: true, screenMonitorEnabled: true, screenMonitorStartedAt: true },
  });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  // فقط اگر وضعیت تغییر کرده باشد، بنویس
  const now = new Date();
  if (device.screenMonitorEnabled !== enabled) {
    await db.$transaction(async (tx) => {
      await tx.device.update({
        where: { id },
        data: {
          screenMonitorEnabled: enabled,
          screenMonitorStartedAt: enabled ? now : null,
        },
      });
      await tx.eventLog.create({
        data: {
          deviceId: id,
          type: "SCREEN",
          message: enabled
            ? "پایش صفحه روشن شد — گوشی هر ۱۰ ثانیه اسکرین‌شات می‌فرستد"
            : "پایش صفحه خاموش شد",
        },
      });
    });
  }

  return NextResponse.json({
    ok: true,
    enabled,
    startedAt: enabled ? now.toISOString() : null,
  });
}

/**
 * گرفتن وضعیت فعلی پایش صفحه (بدون تغییر).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const device = await db.device.findUnique({
    where: { id },
    select: {
      screenMonitorEnabled: true,
      screenMonitorStartedAt: true,
      _count: { select: { screens: true } },
    },
  });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  // آخرین اسکرین‌شات گرفته‌شده
  const last = await db.screenCapture.findFirst({
    where: { deviceId: id },
    orderBy: { takenAt: "desc" },
    select: { id: true, takenAt: true },
  });

  return NextResponse.json({
    enabled: device.screenMonitorEnabled,
    startedAt: device.screenMonitorStartedAt,
    totalCaptured: device._count.screens,
    lastCapture: last
      ? { id: last.id, takenAt: last.takenAt }
      : null,
  });
}
