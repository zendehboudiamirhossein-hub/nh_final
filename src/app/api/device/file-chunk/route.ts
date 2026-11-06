import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * دستگاه پس از دریافت درخواست «download» از sync، فایل را به چند chunk
 * تقسیم می‌کند و هر chunk را به این endpoint می‌فرستد.
 *
 * **بدون محدودیت حجم** — کل فایل می‌تواند چند گیگابایت باشد؛ فقط هر chunk
 * باید زیر ~۱.۵ مگابایت باشد تا با default body size limit Next.js
 * سازگار باشد.
 *
 * هدر: X-Device-Token
 * بدنه: {
 *   requestId: string,
 *   index: number,         // شماره‌ی chunk (از ۰)
 *   total: number,         // کل تعداد chunkها
 *   data: string (base64), // محتوای chunk (حداکثر ~۸۰۰ کیلوبایت خام)
 *   fileName?: string,     // نام فایل (در chunk اول)
 *   mimeType?: string,     // mime type (در chunk اول)
 *   fileSize?: number,     // کل حجم فایل (در chunk اول)
 *   error?: string         // اگر خطایی در خواندن فایل رخ داد
 * }
 *
 * پاسخ: { ok, received, total, complete }
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

  const requestId = String(body?.requestId ?? "").trim();
  if (!requestId || requestId.length > 50) {
    return NextResponse.json({ error: "requestId لازم است" }, { status: 400 });
  }

  // پیدا کردن درخواست
  const fr = await db.fileRequest.findUnique({
    where: { id: requestId },
    select: { id: true, deviceId: true, type: true, status: true, content: true, chunksTotal: true, chunksReceived: true, fileName: true, mimeType: true, fileSize: true },
  });
  if (!fr || fr.deviceId !== device.id || fr.type !== "download") {
    return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });
  }

  // اگر درخواست ERROR شده، دیگه chunk قبول نکن
  if (fr.status === "ERROR") {
    return NextResponse.json({ error: "request is in error state" }, { status: 400 });
  }

  // اگر خطایی در گوشی رخ داده
  const errMsg = typeof body?.error === "string" ? body.error.slice(0, 300) : null;
  if (errMsg) {
    await db.fileRequest.update({
      where: { id: requestId },
      data: {
        status: "ERROR",
        error: errMsg,
        doneAt: new Date(),
        // محتوای ناقص را پاک کن
        content: null,
      },
    });
    return NextResponse.json({ ok: true, error: errMsg });
  }

  const index = typeof body?.index === "number" && Number.isInteger(body.index) && body.index >= 0
    ? body.index
    : null;
  const total = typeof body?.total === "number" && Number.isInteger(body.total) && body.total > 0
    ? body.total
    : null;
  const data = typeof body?.data === "string" ? body.data : null;

  if (index === null || total === null || !data) {
    return NextResponse.json({ error: "index, total, data لازم است" }, { status: 400 });
  }
  if (data.length > 2_000_000) {
    return NextResponse.json({ error: "chunk بیش از حد بزرگ است" }, { status: 413 });
  }

  // decode base64
  const buf = Buffer.from(data, "base64");
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "chunk خالی است" }, { status: 400 });
  }

  // در chunk اول، metadata را ذخیره کن
  const isFirst = index === 0;
  const newTotal = isFirst ? total : (fr.chunksTotal || total);
  const newReceived = (fr.chunksReceived || 0) + 1;

  // chunk را به content اضافه کن — اگر content وجود دارد، append کن
  const existingContent = fr.content ?? Buffer.alloc(0);
  const newContent = Buffer.concat([existingContent, buf]);

  // اگر همه‌ی chunkها رسیدند → DONE
  const isComplete = newReceived >= newTotal;

  const updateData: any = {
    content: newContent,
    chunksTotal: newTotal,
    chunksReceived: newReceived,
  };
  if (isFirst) {
    const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : null;
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType.slice(0, 100) : null;
    const fileSize = typeof body?.fileSize === "number" && Number.isFinite(body.fileSize)
      ? Math.max(0, Math.min(2 ** 31 - 1, Math.round(body.fileSize)))
      : null;
    if (fileName) updateData.fileName = fileName;
    if (mimeType) updateData.mimeType = mimeType;
    if (fileSize !== null) updateData.fileSize = fileSize;
  }
  if (isComplete) {
    updateData.status = "DONE";
    updateData.doneAt = new Date();
    // حجم نهایی را همیشه با طول واقعی محتوای ذخیره‌شده همگام کن تا
    // Content-Length دانلود دقیقاً با محتوا مطابقت کند (حتی اگر
    // دستگاه fileSize نادرست فرستاده باشد یا فایل در حین ارسال تغییر کرده باشد).
    updateData.fileSize = newContent.byteLength;
  }

  await db.fileRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  return NextResponse.json({
    ok: true,
    received: newReceived,
    total: newTotal,
    complete: isComplete,
    bytesSoFar: newContent.byteLength,
  });
}

/**
 * GET: metadata یک درخواست فایل (شامل progress برای chunkهای در حال دریافت).
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-device-token");
  if (!token) {
    return NextResponse.json({ error: "توکن دستگاه لازم است" }, { status: 401 });
  }

  const device = await db.device.findUnique({ where: { token } });
  if (!device) {
    return NextResponse.json({ error: "توکن نامعتبر است" }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestId = url.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "requestId لازم است" }, { status: 400 });
  }

  const fr = await db.fileRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      deviceId: true,
      type: true,
      path: true,
      status: true,
      chunksTotal: true,
      chunksReceived: true,
      fileSize: true,
      fileName: true,
    },
  });
  if (!fr || fr.deviceId !== device.id) {
    return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: fr.status,
    progress: fr.chunksTotal > 0 ? (fr.chunksReceived / fr.chunksTotal) : 0,
    chunksReceived: fr.chunksReceived,
    chunksTotal: fr.chunksTotal,
    fileSize: fr.fileSize,
    fileName: fr.fileName,
  });
}
