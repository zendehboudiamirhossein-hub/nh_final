import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * مکان‌یابی فوری گوشی.
 * POST → یک فرمان LOCATE (PENDING) می‌سازد که در همگام‌سازی بعدی دستگاه
 *        به آن داده می‌شود. دستگاه موقعیت تازه GPS می‌گیرد و در همان
 *        همگام‌سازی می‌فرستد. سرور فرمان را به DONE تبدیل می‌کند.
 *
 * نکته: چون راه‌اندازی فوری گوشی از سرور بدون push notification ممکن نیست،
 *       دستگاه در اولین فرصت (حداکثر ۶۰ ثانیه بعد از طریق WatchdogService)
 *       همگام‌سازی می‌کند و موقعیت تازه می‌فرستد.
 *
 * پاسخ: { ok, commandId, createdAt }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;
  const device = await db.device.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  // اگر فرمان LOCATE در انتظار موجود است، همان را نگه می‌داریم تا چندبار
  // زدن دکمه باعث انباشت فرمان نشود
  const existing = await db.deviceCommand.findFirst({
    where: {
      deviceId: id,
      status: "PENDING",
      type: "LOCATE",
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // ۵ دقیقه اخیر
    },
    select: { id: true, createdAt: true },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      commandId: existing.id,
      createdAt: existing.createdAt,
      pending: true,
    });
  }

  const cmd = await db.deviceCommand.create({
    data: { deviceId: id, type: "LOCATE", status: "PENDING" },
  });
  await db.eventLog.create({
    data: {
      deviceId: id,
      type: "LOCATE",
      message: "درخواست مکان‌یابی فوری از طرف ادمین",
    },
  });
  return NextResponse.json({ ok: true, commandId: cmd.id, createdAt: cmd.createdAt });
}
