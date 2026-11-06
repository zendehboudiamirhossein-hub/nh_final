import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * POST: ایجاد یک درخواست فایل جدید (list یا download).
 * بدنه: { type: "list" | "download", path: string }
 *
 * پس از ایجاد، در همگام‌سازی بعدی دستگاه درخواست را می‌بیند و پردازش
 * می‌کند. ادمین می‌تواند وضعیت را با GET همین endpoint ببیند.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  const type = body?.type === "list" ? "list" : body?.type === "download" ? "download" : null;
  const path = typeof body?.path === "string" ? body.path.trim() : "";

  if (!type) {
    return NextResponse.json({ error: "type باید list یا download باشد" }, { status: 400 });
  }
  if (!path || path.length > 500) {
    return NextResponse.json({ error: "path لازم است (حداکثر ۵۰۰ کاراکتر)" }, { status: 400 });
  }

  // تایید وجود دستگاه
  const device = await db.device.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  // محدودسازی تعداد درخواست‌های PENDING همزمان برای هر دستگاه
  // (جلوگیری از انباشت)
  const pendingCount = await db.fileRequest.count({
    where: { deviceId: id, status: "PENDING" },
  });
  if (pendingCount >= 10) {
    return NextResponse.json(
      { error: "تعداد زیادی درخواست در انتظار وجود دارد — ابتدا منتظر بمانید تا پردازش شوند" },
      { status: 429 }
    );
  }

  const fr = await db.fileRequest.create({
    data: {
      deviceId: id,
      type,
      path,
    },
  });

  await db.eventLog.create({
    data: {
      deviceId: id,
      type: "FILE",
      message: `درخواست ${type === "list" ? "لیست فایل‌ها" : "دانلود فایل"} برای مسیر «${path}» ثبت شد`,
    },
  });

  return NextResponse.json({
    ok: true,
    id: fr.id,
    type: fr.type,
    path: fr.path,
    status: fr.status,
    createdAt: fr.createdAt,
  });
}

/**
 * GET: فهرست درخواست‌های فایل اخیر (PENDING + اخیراً DONE شده).
 * پارامتر ?status=PENDING برای فقط موارد در انتظار.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const take = Math.min(100, Number(url.searchParams.get("take") ?? "50") || 50);

  const where = {
    deviceId: id,
    ...(status === "PENDING" || status === "DONE" || status === "ERROR"
      ? { status }
      : {}),
  };

  const requests = await db.fileRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      path: true,
      status: true,
      error: true,
      createdAt: true,
      doneAt: true,
      chunksTotal: true,
      chunksReceived: true,
      fileSize: true,
      fileName: true,
      mimeType: true,
    },
  });

  // برای هر درخواست، تعداد entries در listing را هم برگردان
  const items = requests.map((r) => {
    return {
      id: r.id,
      type: r.type,
      path: r.path,
      status: r.status,
      error: r.error,
      createdAt: r.createdAt,
      doneAt: r.doneAt,
      chunksTotal: r.chunksTotal,
      chunksReceived: r.chunksReceived,
      fileSize: r.fileSize,
      fileName: r.fileName,
      mimeType: r.mimeType,
    };
  });

  return NextResponse.json({ requests: items });
}

/**
 * DELETE: لغو یک درخواست فایل PENDING یا حذف درخواست‌های قدیمی DONE.
 * پارامتر ?id=X برای حذف یک درخواست خاص؛ بدون پارامتر برای پاکسازی
 * همه‌ی درخواست‌های DONE/ERROR قدیمی‌تر از ۷ روز.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const url = new URL(req.url);
  const requestId = url.searchParams.get("id");

  if (requestId) {
    // حذف یک درخواست خاص
    const fr = await db.fileRequest.findUnique({
      where: { id: requestId },
      select: { id: true, deviceId: true, status: true },
    });
    if (!fr || fr.deviceId !== id) {
      return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
    }
    await db.fileRequest.delete({ where: { id: requestId } });
    return NextResponse.json({ ok: true });
  }

  // پاکسازی: درخواست‌های DONE/ERROR قدیمی‌تر از ۷ روز
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await db.fileRequest.deleteMany({
    where: {
      deviceId: id,
      status: { in: ["DONE", "ERROR"] },
      createdAt: { lt: cutoff },
    },
  });
  return NextResponse.json({ ok: true, deleted: result.count });
}
