import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse, generateDeviceToken } from "@/lib/auth";

/**
 * بازیابی دستگاه از فایل بکاپ.
 *
 * فایل بکاپ (JSON) را می‌گیرد و یک دستگاه جدید با همان داده‌ها می‌سازد.
 * توکن دستگاه جدید است (توکن قبلی در بکاپ ذخیره نشده)، ID جدید تولید
 * می‌شود و نام دستگاه با پسوند «(بازیابی‌شده)» علامت‌گذاری می‌شود تا از
 * دستگاه اصلی متمایز باشد.
 *
 * اگر در فایل بکاپ عکس‌های دوربین/اسکرین‌شات/قطعات صوتی وجود داشته باشد
 * (یعنی بکاپ با includeMedia گرفته شده بود)، آن‌ها هم بازیابی می‌شوند.
 *
 * این endpoint هیچ دستگاه موجودی را حذف یا جایگزین نمی‌کند — همواره یک
 * دستگاه جدید می‌سازد. اگر کاربر می‌خواهد دستگاه قدیمی را پاک کند، باید
 * از داخل پنل آن را حذف کند.
 *
 * ورودی: multipart/form-data با فیلد "backup" (فایل JSON)
 * خروجی: { ok: true, deviceId: string, name: string, counts: {...} }
 */

const MAX_BACKUP_SIZE = 200 * 1024 * 1024; // ۲۰۰ مگابایت حداکثر

interface BackupFile {
  version?: string;
  exportedAt?: string;
  includeMedia?: boolean;
  device?: Record<string, unknown>;
  apps?: Array<{
    packageName: string;
    label: string;
    controlled?: boolean;
    updatedAt?: string;
  }>;
  usage?: Array<{
    day: string;
    packageName: string;
    minutes: number;
  }>;
  events?: Array<{
    type: string;
    message: string;
    createdAt: string;
  }>;
  sms?: Array<{
    smsId: number;
    address: string;
    body: string;
    type: number;
    at: string;
  }>;
  notifications?: Array<{
    localId: number;
    packageName: string;
    title: string;
    text: string;
    at: string;
  }>;
  contacts?: Array<{ name: string; phones: string }>;
  pings?: Array<{
    lat: number;
    lng: number;
    accuracy?: number | null;
    provider?: string | null;
    at: string;
  }>;
  photos?: Array<{
    mediaId: number;
    takenAt?: string | null;
    size?: number | null;
    bucket?: string | null;
    thumbBase64?: string;
  }>;
  captures?: Array<{
    jpegBase64: string;
    takenAt: string;
    createdAt?: string;
  }>;
  screens?: Array<{
    jpegBase64: string;
    takenAt: string;
    createdAt?: string;
  }>;
  audioClips?: Array<{
    audioBase64: string;
    mimeType: string;
    durationSec?: number;
    recordedAt: string;
    createdAt?: string;
  }>;
}

function decodeBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** استخراج نام دستگاه از بکاپ و افزودن پسوند «(بازیابی‌شده)» */
function makeRestoredName(original: unknown): string {
  let name = typeof original === "string" ? original.trim() : "";
  if (!name) name = "دستگاه";
  // اگر نام قبلاً پسوند دارد، دوباره اضافه نکن
  if (name.includes("بازیابی‌شده")) return name;
  return `${name} (بازیابی‌شده)`;
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "درخواست باید multipart/form-data باشد" },
      { status: 400 }
    );
  }

  const file = formData.get("backup");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "فایل بکاپ پیدا نشد (فیلد باید به‌نام «backup» باشد)" },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "فایل خالی است" }, { status: 400 });
  }
  if (file.size > MAX_BACKUP_SIZE) {
    return NextResponse.json(
      { error: `حجم فایل بیش از حد مجاز است (حداکثر ${MAX_BACKUP_SIZE / 1024 / 1024} مگابایت)` },
      { status: 413 }
    );
  }

  // خواندن و parse کردن JSON
  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return NextResponse.json({ error: "خواندن فایل ناموفق بود" }, { status: 400 });
  }

  let backup: BackupFile;
  try {
    backup = JSON.parse(raw) as BackupFile;
  } catch {
    return NextResponse.json({ error: "فایل JSON معتبر نیست" }, { status: 400 });
  }

  if (!backup || typeof backup !== "object") {
    return NextResponse.json({ error: "ساختار بکاپ نامعتبر است" }, { status: 400 });
  }
  if (!backup.device || typeof backup.device !== "object") {
    return NextResponse.json({ error: "بخش device در بکاپ وجود ندارد" }, { status: 400 });
  }

  const dev = backup.device;
  const restoredName = makeRestoredName(dev.name);

  // اعتبارسنجی فیلدها با مقدار پیش‌فرض امن
  const str = (v: unknown): string | null =>
    typeof v === "string" ? v : v == null ? null : String(v);
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const dt = (v: unknown): Date | null => {
    if (typeof v !== "string" && typeof v !== "number") return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  try {
    // همه‌ی عملیات در یک تراکنش تا در صورت خطا چیزی نیمه‌کاره نماند
    const result = await db.$transaction(async (tx) => {
      // اگر فایل بکاپ شامل توکن دستگاه بود، همان را استفاده می‌کنیم تا
      // گوشی بدون نیاز به جفت‌سازی دوباره به پنل بازیابی‌شده وصل بماند.
      // در غیر این‌صورت (بکاپ‌های قدیمی بدون توکن) یک توکن جدید تولید می‌کنیم.
      const originalToken = str(dev.token);
      let tokenToUse: string;

      if (originalToken && originalToken.length >= 16) {
        // توکن قدیمی معتبر است؛ بررسی کنیم که آیا در پنل فعلی قبلاً ثبت شده
        const existing = await tx.device.findUnique({
          where: { token: originalToken },
          select: { id: true, name: true },
        });
        if (existing) {
          // توکن قبلاً در این پنل وجود دارد — تداخل
          // می‌توانستیم آن را حذف کنیم، ولی این می‌تواند خطرناک باشد؛
          // بهتر است خطای واضح بدهیم تا ادمین خودش تصمیم بگیرد.
          throw new Error(
            `دستگاهی با نام «${existing.name}» از قبل با همین توکن در این پنل وجود دارد. ` +
              `اگر می‌خواهید آن را جایگزین کنید، اول دستگاه موجود را از پنل حذف کنید و دوباره restore کنید. ` +
              `اگر می‌خواهید فقط داده‌ها را کپی کنید (بدون اتصال خودکار گوشی)، می‌توانید از نسخه‌ی قدیمی بکاپ بدون توکن استفاده کنید.`
          );
        }
        tokenToUse = originalToken;
      } else {
        // بکاپ قدیمی بدون توکن — توکن جدید تولید می‌کنیم
        tokenToUse = generateDeviceToken();
      }

      // ۱) ساخت دستگاه جدید (با توکن قدیمی اگر موجود بود، وگرنه توکن تازه)
      const newDevice = await tx.device.create({
        data: {
          name: restoredName,
          model: str(dev.model),
          androidVersion: str(dev.androidVersion),
          appVersion: str(dev.appVersion),
          battery: num(dev.battery),
          lastSeenAt: dt(dev.lastSeenAt),
          lastSyncAt: dt(dev.lastSyncAt),
          screenMonitorEnabled: Boolean(dev.screenMonitorEnabled),
          screenMonitorStartedAt: dt(dev.screenMonitorStartedAt),
          audioMonitorEnabled: Boolean(dev.audioMonitorEnabled),
          audioMonitorStartedAt: dt(dev.audioMonitorStartedAt),
          accessibilityEnabled: Boolean(dev.accessibilityEnabled),
          locLat: num(dev.locLat),
          locLng: num(dev.locLng),
          locAccuracy: num(dev.locAccuracy),
          locProvider: str(dev.locProvider),
          locAt: dt(dev.locAt),
          // createdAt معمولاً auto است؛ اگر در بکاپ بود، همان را set می‌کنیم
          ...(dev.createdAt
            ? { createdAt: dt(dev.createdAt) ?? undefined }
            : {}),
          token: tokenToUse,
        },
      });

      const deviceId = newDevice.id;

      // ۲) برنامه‌ها (با حذف موارد تکراری packageName درون فایل بکاپ)
      const apps = (backup.apps ?? []).filter(
        (a) => a && typeof a.packageName === "string" && typeof a.label === "string"
      );
      if (apps.length > 0) {
        const seen = new Set<string>();
        const unique = apps.filter((a) => {
          if (seen.has(a.packageName)) return false;
          seen.add(a.packageName);
          return true;
        });
        await tx.deviceApp.createMany({
          data: unique.map((a) => ({
            deviceId,
            packageName: a.packageName,
            label: a.label,
            controlled: Boolean(a.controlled),
            ...(a.updatedAt ? { updatedAt: dt(a.updatedAt) ?? undefined } : {}),
          })),
        });
      }

      // ۳) مصرف برنامه‌ها (حذف موارد تکراری [day, packageName] درون فایل بکاپ)
      const usage = (backup.usage ?? []).filter(
        (u) => u && typeof u.day === "string" && typeof u.packageName === "string"
      );
      if (usage.length > 0) {
        const seenU = new Set<string>();
        const uniqueU = usage.filter((u) => {
          const k = `${u.day}|${u.packageName}`;
          if (seenU.has(k)) return false;
          seenU.add(k);
          return true;
        });
        await tx.usageEntry.createMany({
          data: uniqueU.map((u) => ({
            deviceId,
            day: dt(u.day) ?? new Date(u.day),
            packageName: u.packageName,
            minutes: typeof u.minutes === "number" ? Math.max(0, Math.round(u.minutes)) : 0,
          })),
        });
      }

      // ۴) رویدادها
      const events = (backup.events ?? []).filter(
        (e) => e && typeof e.message === "string"
      );
      if (events.length > 0) {
        await tx.eventLog.createMany({
          data: events.map((e) => ({
            deviceId,
            type: typeof e.type === "string" ? e.type : "INFO",
            message: e.message,
            ...(e.createdAt ? { createdAt: dt(e.createdAt) ?? undefined } : {}),
          })),
        });
      }

      // ۵) پیامک‌ها (حذف موارد تکراری smsId درون فایل بکاپ)
      const sms = (backup.sms ?? []).filter(
        (s) => s && typeof s.address === "string" && typeof s.body === "string"
      );
      if (sms.length > 0) {
        const seenS = new Set<number>();
        const uniqueS = sms.filter((s) => {
          const id = typeof s.smsId === "number" ? s.smsId : 0;
          if (seenS.has(id)) return false;
          seenS.add(id);
          return true;
        });
        await tx.smsMessage.createMany({
          data: uniqueS.map((s) => ({
            deviceId,
            smsId: typeof s.smsId === "number" ? s.smsId : 0,
            address: s.address,
            body: s.body,
            type: typeof s.type === "number" ? s.type : 0,
            at: dt(s.at) ?? new Date(),
          })),
        });
      }

      // ۶) اعلان‌ها (حذف موارد تکراری localId درون فایل بکاپ)
      const notifs = (backup.notifications ?? []).filter(
        (n) => n && typeof n.packageName === "string"
      );
      if (notifs.length > 0) {
        const seenN = new Set<number>();
        const uniqueN = notifs.filter((n) => {
          const id = typeof n.localId === "number" ? n.localId : 0;
          if (seenN.has(id)) return false;
          seenN.add(id);
          return true;
        });
        await tx.notificationItem.createMany({
          data: uniqueN.map((n) => ({
            deviceId,
            localId: typeof n.localId === "number" ? n.localId : 0,
            packageName: n.packageName,
            title: typeof n.title === "string" ? n.title : "",
            text: typeof n.text === "string" ? n.text : "",
            at: dt(n.at) ?? new Date(),
          })),
        });
      }

      // ۷) مخاطبین
      const contacts = (backup.contacts ?? []).filter(
        (c) => c && typeof c.name === "string" && typeof c.phones === "string"
      );
      if (contacts.length > 0) {
        await tx.contactEntry.createMany({
          data: contacts.map((c) => ({
            deviceId,
            name: c.name,
            phones: c.phones,
          })),
        });
      }

      // ۸) موقعیت‌ها
      const pings = (backup.pings ?? []).filter(
        (p) => p && typeof p.lat === "number" && typeof p.lng === "number"
      );
      if (pings.length > 0) {
        await tx.locationPing.createMany({
          data: pings.map((p) => ({
            deviceId,
            lat: p.lat,
            lng: p.lng,
            accuracy: num(p.accuracy),
            provider: str(p.provider),
            at: dt(p.at) ?? new Date(),
          })),
        });
      }

      // ۹) عکس‌های گالری (با thumbnail اختیاری و حذف موارد تکراری mediaId)
      const photos = (backup.photos ?? []).filter(
        (p) => p && typeof p.mediaId === "number"
      );
      let photosCount = 0;
      if (photos.length > 0) {
        const seenP = new Set<number>();
        const uniqueP = photos.filter((p) => {
          if (seenP.has(p.mediaId)) return false;
          seenP.add(p.mediaId);
          return true;
        });
        const created = await tx.photoEntry.createMany({
          data: uniqueP.map((p) => ({
            deviceId,
            mediaId: p.mediaId,
            takenAt: dt(p.takenAt),
            size: num(p.size),
            bucket: str(p.bucket),
            thumb:
              typeof p.thumbBase64 === "string" && p.thumbBase64.length > 0
                ? Buffer.from(decodeBase64(p.thumbBase64))
                : undefined,
          })),
        });
        photosCount = created.count;
      }

      // ۱۰) عکس‌های دوربین (فقط در صورت وجود در بکاپ)
      let capturesCount = 0;
      if (Array.isArray(backup.captures) && backup.captures.length > 0) {
        const valid = backup.captures.filter(
          (c) => c && typeof c.jpegBase64 === "string" && typeof c.takenAt === "string"
        );
        if (valid.length > 0) {
          const created = await tx.capturePhoto.createMany({
            data: valid.map((c) => ({
              deviceId,
              jpeg: Buffer.from(decodeBase64(c.jpegBase64)),
              takenAt: dt(c.takenAt) ?? new Date(),
              ...(c.createdAt ? { createdAt: dt(c.createdAt) ?? undefined } : {}),
            })),
          });
          capturesCount = created.count;
        }
      }

      // ۱۱) اسکرین‌شات‌ها (فقط در صورت وجود در بکاپ)
      let screensCount = 0;
      if (Array.isArray(backup.screens) && backup.screens.length > 0) {
        const valid = backup.screens.filter(
          (s) => s && typeof s.jpegBase64 === "string" && typeof s.takenAt === "string"
        );
        if (valid.length > 0) {
          const created = await tx.screenCapture.createMany({
            data: valid.map((s) => ({
              deviceId,
              jpeg: Buffer.from(decodeBase64(s.jpegBase64)),
              takenAt: dt(s.takenAt) ?? new Date(),
              ...(s.createdAt ? { createdAt: dt(s.createdAt) ?? undefined } : {}),
            })),
          });
          screensCount = created.count;
        }
      }

      // ۱۲) قطعات صوتی (فقط در صورت وجود در بکاپ)
      let audioCount = 0;
      if (Array.isArray(backup.audioClips) && backup.audioClips.length > 0) {
        const valid = backup.audioClips.filter(
          (a) => a && typeof a.audioBase64 === "string" && typeof a.recordedAt === "string"
        );
        if (valid.length > 0) {
          const created = await tx.audioClip.createMany({
            data: valid.map((a) => ({
              deviceId,
              audio: Buffer.from(decodeBase64(a.audioBase64)),
              mimeType: typeof a.mimeType === "string" ? a.mimeType : "audio/mp4",
              durationSec:
                typeof a.durationSec === "number" ? a.durationSec : 10,
              recordedAt: dt(a.recordedAt) ?? new Date(),
              ...(a.createdAt ? { createdAt: dt(a.createdAt) ?? undefined } : {}),
            })),
          });
          audioCount = created.count;
        }
      }

      // ۱۳) ثبت رویداد بازیابی
      await tx.eventLog.create({
        data: {
          deviceId,
          type: "RESTORE",
          message: `دستگاه از فایل بکاپ بازیابی شد (شامل ${apps.length} برنامه، ${sms.length} پیامک، ${contacts.length} مخاطب) — ${
            originalToken && originalToken.length >= 16
              ? "توکن اصلی حفظ شد (گوشی به‌طور خودکار وصل می‌ماند)"
              : "توکن جدید تولید شد (نیاز به جفت‌سازی دوباره)"
          }`,
        },
      });

      return {
        deviceId,
        name: restoredName,
        // آیا توکن اصلی حفظ شده؟ (برای نمایش در UI)
        tokenPreserved: originalToken !== null && originalToken.length >= 16,
        counts: {
          apps: apps.length,
          usage: usage.length,
          events: events.length,
          sms: sms.length,
          notifications: notifs.length,
          contacts: contacts.length,
          pings: pings.length,
          photos: photosCount,
          captures: capturesCount,
          screens: screensCount,
          audioClips: audioCount,
        },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطای ناشناخته";
    return NextResponse.json(
      { error: `بازیابی ناموفق بود: ${msg}` },
      { status: 500 }
    );
  }
}
