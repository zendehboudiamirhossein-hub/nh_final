import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * دریافت اسکرین‌شات دوره‌ای صفحه از دستگاه (هر ۱۰ ثانیه وقتی پایش صفحه فعال است).
 * هدر: X-Device-Token
 * بدنه: { image: base64, at?: number }
 * پاسخ: { ok, saved, total }
 *
 * نکته‌ی ذخیره‌سازی: برای جلوگیری از انباشته‌شدن بیش از حد، فقط ۲۰۰
 * اسکرین‌شات آخر هر دستگاه نگه داشته می‌شود؛ قدیمی‌ترها حذف می‌شوند.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-device-token");
  if (!token) {
    return NextResponse.json({ error: "توکن دستگاه لازم است" }, { status: 401 });
  }

  const device = await db.device.findUnique({ where: { token } });
  if (!device) {
    return NextResponse.json({ error: "توکن نامعتبر است" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });
  }

  const image = typeof body?.image === "string" ? body.image : null;
  if (!image || image.length === 0 || image.length > 1_500_000) {
    return NextResponse.json(
      { error: "تصویر لازم است (حداکثر ۱.۱ مگابایت base64)" },
      { status: 400 }
    );
  }

  const atRaw =
    typeof body?.at === "number" && Number.isFinite(body.at as number)
      ? (body.at as number)
      : Date.now();
  const at = new Date(atRaw);

  // فقط وقتی ذخیره کن که پایش روشن باشد (اگر ادمین خاموش کرده باشد
  // و دستگاه هنوز فرستاده، نادیده می‌گیریم)
  const buf = Buffer.from(image, "base64");
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "تصویر خالی است" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.screenCapture.create({
      data: {
        deviceId: device.id,
        jpeg: buf,
        takenAt: at,
      },
    });

    // نگه‌داشتن فقط ۲۰۰ اسکرین‌شات آخر برای جلوگیری از انباشت
    const keep = await tx.screenCapture.findMany({
      where: { deviceId: device.id },
      orderBy: { takenAt: "desc" },
      take: 200,
      select: { id: true },
    });
    if (keep.length === 200) {
      await tx.screenCapture.deleteMany({
        where: {
          deviceId: device.id,
          id: { notIn: keep.map((s) => s.id) },
        },
      });
    }

    // به‌روزرسانی آخرین موقعیت دستگاه و ثبت رویداد
    await tx.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    await tx.eventLog.create({
      data: {
        deviceId: device.id,
        type: "SCREEN",
        message: "اسکرین‌شات صفحه دریافت شد",
      },
    });
  });

  const total = await db.screenCapture.count({ where: { deviceId: device.id } });

  return NextResponse.json({ ok: true, saved: 1, total });
}
