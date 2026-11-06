/**
 * تست سرتاسری پنل نگهبان:
 * ورود ادمین ← کد جفت‌سازی ← ثبت‌نام دستگاه (شبیه‌سازی اپ اندروید)
 * ← همگام‌سازی داده آزمایشی (اپ‌ها/مصرف/پیامک/اعلان/گالری/مخاطبین)
 * ← بررسی جزئیات دستگاه + سرو thumbnail + خروجی CSV + کنترل احراز هویت
 */
import sharp from "sharp";

const BASE = "http://localhost:3000";
const PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function ok(name: string, cond: boolean, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " — " + name + (extra ? " (" + extra + ")" : ""));
  if (!cond) process.exitCode = 1;
}

async function main() {
  // JPEG آزمایشی معتبر (۹۶×۹۶) با sharp ساخته می‌شود
  const JPEG_1x1 = (
    await sharp({
      create: { width: 96, height: 96, channels: 3, background: { r: 139, g: 124, b: 255 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer()
  ).toString("base64");
  // ---------- ۱) ورود ادمین ----------
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  ok("ورود ادمین", login.status === 200);
  const setCookie =
    (login.headers as any).getSetCookie?.()?.[0] ?? login.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  ok("کوکی نشست", cookie.length > 10);
  const adminHeaders = { cookie, "content-type": "application/json" };

  // ---------- ۲) ساخت کد جفت‌سازی ----------
  const pair = await (
    await fetch(`${BASE}/api/admin/pairing`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ note: "تست خودکار" }),
    })
  ).json();
  const code: string | undefined = pair?.code?.code;
  ok("ساخت کد جفت‌سازی", typeof code === "string" && /^\d{6}$/.test(code as string));

  // ---------- ۳) ثبت‌نام دستگاه (شبیه‌سازی اپ اندروید) ----------
  const reg = await (
    await fetch(`${BASE}/api/device/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pairingCode: code,
        name: "گوشی آزمایشی",
        model: "Test Pixel 8",
        androidVersion: "14",
        appVersion: "1.0",
      }),
    })
  ).json();
  ok("ثبت‌نام دستگاه", Boolean(reg.token && reg.deviceId));
  const devHeaders = {
    "x-device-token": reg.token as string,
    "content-type": "application/json",
  };

  // ---------- ۴) همگام‌سازی با داده آزمایشی ----------
  const now = Date.now();
  const dayKey = (offset: number) =>
    new Date(now - offset * 86400000).toISOString().slice(0, 10);

  const syncBody = {
    battery: 67,
    apps: [
      { packageName: "ir.instagram", label: "اینستاگرام", controlled: false },
      { packageName: "com.example.game", label: "بازی آزمایشی", controlled: true },
    ],
    usage: [
      { day: dayKey(0), packageName: "ir.instagram", minutes: 42 },
      { day: dayKey(1), packageName: "ir.instagram", minutes: 65 },
      { day: dayKey(1), packageName: "com.example.game", minutes: 20 },
    ],
    sms: [
      { id: 101, address: "+989121234567", body: "سلام، به موقع برس", date: now - 3600e3, type: 1 },
      { id: 102, address: "+989121234567", body: "اوکی", date: now - 3500e3, type: 2 },
      { id: 103, address: "5004", body: "کد تایید: ۱۲۳۴", date: now - 3000e3, type: 1 },
    ],
    notifications: [
      { id: 1, packageName: "ir.instagram", title: "پیام جدید", text: "کاربر جدیدی دنبالت می‌کند", at: now - 1200e3 },
      { id: 2, packageName: "com.example.game", title: "انرژی پر شد", text: "", at: now - 600e3 },
    ],
    photos: [
      { mediaId: 9001, takenAt: now - 2 * 864e5, size: 2400000, bucket: "Camera" },
      { mediaId: 9002, takenAt: now - 5 * 864e5, size: 1200000, bucket: "Camera" },
      { mediaId: 9003, takenAt: now - 9 * 864e5, size: 900000, bucket: "Screenshots" },
    ],
    thumbs: [
      { mediaId: 9001, image: JPEG_1x1 },
      { mediaId: 9002, image: JPEG_1x1 },
    ],
    contacts: [
      { name: "مامان", phones: ["09121234567", "09121110000"] },
      { name: "خدمات بانکی", phones: ["5004"] },
      { name: "آقای احمدی", phones: ["02188776655"] },
    ],
    location: { lat: 35.715298, lng: 51.404343, accuracy: 18, provider: "network", at: now - 60e3 },
  };

  const sync = await fetch(`${BASE}/api/device/sync`, {
    method: "POST",
    headers: devHeaders,
    body: JSON.stringify(syncBody),
  });
  const syncJson = await sync.json().catch(() => ({}));
  ok("همگام‌سازی", sync.status === 200 && syncJson.ok === true, JSON.stringify(syncJson));

  // ---------- ۵) جزئیات دستگاه از دید ادمین ----------
  const detail = await (
    await fetch(`${BASE}/api/admin/devices/${reg.deviceId}`, { headers: { cookie } })
  ).json();
  ok("پیامک‌ها در جزئیات", Array.isArray(detail.sms) && detail.sms.length === 3);
  ok("اعلان‌ها در جزئیات", Array.isArray(detail.notifications) && detail.notifications.length === 2);
  ok(
    "گالری در جزئیات",
    Array.isArray(detail.photos) &&
      detail.photos.length === 3 &&
      detail.photos.filter((p: any) => p.hasThumb).length === 2
  );
  ok(
    "شمارنده‌ها",
    detail.counts?.sms === 3 && detail.counts?.notifs === 2 && detail.counts?.photos === 3,
    JSON.stringify(detail.counts)
  );
  ok("ترتیب پیامک (جدید اول)", detail.sms?.[0]?.smsId === 103);

  ok(
    "مخاطبین در جزئیات",
    Array.isArray(detail.contacts) && detail.contacts.length === 3,
    JSON.stringify(detail.counts)
  );
  ok("شمارنده مخاطبین", detail.counts?.contacts === 3);

  // ---------- ۵.۷) موقعیت مکانی ----------
  ok(
    "موقعیت در جزئیات",
    detail.location?.lat === 35.715298 &&
      detail.location?.provider === "network" &&
      detail.location?.accuracy === 18
  );
  ok("نقطه‌ی تاریخچه موقعیت", Array.isArray(detail.pings) && detail.pings.length === 1);

  // ---------- ۵.۸) فرمان عکس‌برداری ----------
  const cmdBad = await fetch(`${BASE}/api/admin/devices/${reg.deviceId}/command`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ type: "other" }),
  });
  ok("نوع فرمان نامعتبر رد می‌شود", cmdBad.status === 400);

  const cmd1Res = await fetch(`${BASE}/api/admin/devices/${reg.deviceId}/command`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ type: "capture" }),
  });
  const cmd1 = await cmd1Res.json();
  ok("ثبت فرمان عکس‌برداری", cmd1?.ok === true && typeof cmd1?.id === "string");

  const cmd2 = await (
    await fetch(`${BASE}/api/admin/devices/${reg.deviceId}/command`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ type: "capture" }),
    })
  ).json();
  ok("فرمان تکراری انباشته نمی‌شود", cmd2?.existing === true && cmd2?.id === cmd1?.id);

  // دستگاه در همگام‌سازی بعدی، فرمان را در پاسخ دریافت می‌کند
  const sync2 = await fetch(`${BASE}/api/device/sync`, {
    method: "POST",
    headers: devHeaders,
    body: JSON.stringify({
      location: { lat: 35.7, lng: 51.39, accuracy: 25, provider: "gps", at: now - 30e3 },
    }),
  });
  const sync2Json = await sync2.json().catch(() => ({}));
  const cmdInResp = (sync2Json.commands ?? []).find((c: any) => c.id === cmd1?.id);
  ok("فرمان در پاسخ همگام‌سازی", Boolean(cmdInResp) && cmdInResp.type === "capture", JSON.stringify(sync2Json.commands));

  // شبیه‌سازی ارسال عکس دوربین توسط دستگاه
  const caps = await fetch(`${BASE}/api/device/captures`, {
    method: "POST",
    headers: devHeaders,
    body: JSON.stringify({ captures: [{ commandId: cmd1?.id, image: JPEG_1x1, at: now - 10e3 }] }),
  });
  const capsJson = await caps.json().catch(() => ({}));
  ok("ارسال عکس دوربین", caps.status === 200 && capsJson.saved === 1, JSON.stringify(capsJson));

  const detail2 = await (
    await fetch(`${BASE}/api/admin/devices/${reg.deviceId}`, { headers: { cookie } })
  ).json();
  ok(
    "عکس دوربین در جزئیات",
    detail2.counts?.captures === 1 && Array.isArray(detail2.captures) && detail2.captures.length === 1
  );
  ok("فرمان انجام‌شده", detail2.counts?.pendingCommands === 0, JSON.stringify(detail2.counts));
  ok(
    "موقعیت به‌روزشده",
    detail2.location?.provider === "gps" && detail2.pings?.length === 2,
    JSON.stringify(detail2.location)
  );

  // ---------- ۵.۵) خروجی CSV ----------
  const csvSms = await fetch(`${BASE}/api/admin/devices/${reg.deviceId}/csv?kind=sms`, {
    headers: { cookie },
  });
  const csvSmsBytes = new Uint8Array(await csvSms.arrayBuffer());
  // BOM (EF BB BF) باید در بایت خام موجود باشد — برای باز شدن درست فارسی در اکسل
  const csvSmsText = new TextDecoder("utf-8").decode(csvSmsBytes.subarray(3));
  ok(
    "CSV پیامک‌ها",
    csvSms.status === 200 &&
      (csvSms.headers.get("content-type") ?? "").includes("text/csv") &&
      csvSmsBytes[0] === 0xef &&
      csvSmsBytes[1] === 0xbb &&
      csvSmsBytes[2] === 0xbf &&
      csvSmsText.includes("تاریخ و ساعت") &&
      csvSmsText.includes("سلام، به موقع برس"),
    `bytes=${csvSmsBytes.length}`
  );
  // تطبیق نام مخاطب: شماره +989121234567 باید به «مامان» (09121234567) برسد
  ok("تطبیق نام مخاطب در CSV پیامک", csvSmsText.includes("مامان"));
  const csvSmsFiltered = await fetch(
    `${BASE}/api/admin/devices/${reg.deviceId}/csv?kind=sms&q=${encodeURIComponent("کد تایید")}`,
    { headers: { cookie } }
  );
  const csvSmsFilteredText = await csvSmsFiltered.text();
  ok(
    "CSV پیامک با فیلتر جستجو",
    csvSmsFiltered.status === 200 &&
      csvSmsFilteredText.includes("کد تایید") &&
      !csvSmsFilteredText.includes("سلام، به موقع برس")
  );
  const csvContacts = await fetch(
    `${BASE}/api/admin/devices/${reg.deviceId}/csv?kind=contacts`,
    { headers: { cookie } }
  );
  const csvContactsText = await csvContacts.text();
  ok(
    "CSV مخاطبین",
    csvContacts.status === 200 &&
      csvContactsText.includes("نام مخاطب") &&
      csvContactsText.includes("آقای احمدی") &&
      csvContactsText.includes("02188776655")
  );
  const csvNoAuth = await fetch(`${BASE}/api/admin/devices/${reg.deviceId}/csv?kind=sms`);
  ok("CSV بدون احراز هویت رد می‌شود", csvNoAuth.status === 401);

  // ---------- ۶) سرو thumbnail ----------
  const withThumb = (detail.photos ?? []).find((p: any) => p.hasThumb);
  const img = await fetch(`${BASE}/api/admin/photo/${withThumb.id}`, { headers: { cookie } });
  const imgBytes = await img.arrayBuffer();
  ok(
    "سرو thumbnail",
    img.status === 200 &&
      img.headers.get("content-type") === "image/jpeg" &&
      imgBytes.byteLength > 200,
    `bytes=${imgBytes.byteLength}`
  );

  // ---------- ۶.۵) دانلود عکس ----------
  const imgDownload = await fetch(`${BASE}/api/admin/photo/${withThumb.id}?download=1`, {
    headers: { cookie },
  });
  ok(
    "دانلود عکس (attachment)",
    imgDownload.status === 200 &&
      (imgDownload.headers.get("content-disposition") ?? "").startsWith("attachment")
  );

  // ---------- ۶.۷) سرو و دانلود عکس دوربین ----------
  const capId = detail2.captures[0].id;
  const capImg = await fetch(`${BASE}/api/admin/capture/${capId}`, { headers: { cookie } });
  const capImgBytes = await capImg.arrayBuffer();
  ok(
    "سرو عکس دوربین",
    capImg.status === 200 &&
      capImg.headers.get("content-type") === "image/jpeg" &&
      capImgBytes.byteLength > 200,
    `bytes=${capImgBytes.byteLength}`
  );
  const capDl = await fetch(`${BASE}/api/admin/capture/${capId}?download=1`, {
    headers: { cookie },
  });
  ok(
    "دانلود عکس دوربین (attachment)",
    capDl.status === 200 &&
      (capDl.headers.get("content-disposition") ?? "").startsWith("attachment")
  );
  const capNoAuth = await fetch(`${BASE}/api/admin/capture/${capId}`);
  ok("عکس دوربین بدون احراز هویت رد می‌شود", capNoAuth.status === 401);

  // ---------- ۷) کنترل احراز هویت ----------
  const noAuthImg = await fetch(`${BASE}/api/admin/photo/${withThumb.id}`);
  ok("thumbnail بدون احراز هویت رد می‌شود", noAuthImg.status === 401);
  const badToken = await fetch(`${BASE}/api/device/sync`, {
    method: "POST",
    headers: { "x-device-token": "invalid-token", "content-type": "application/json" },
    body: "{}",
  });
  ok("توکن نامعتبر رد می‌شود", badToken.status === 401);

  console.log("\nRESULT: " + (process.exitCode ? "FAILURES ↑" : "ALL PASS"));
  console.log("TEST_DEVICE_ID=" + reg.deviceId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
