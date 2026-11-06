import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * دستگاه پس از دریافت درخواست «list» از sync، محتوای یک مسیر را
 * به‌صورت JSON در این endpoint ارسال می‌کند.
 *
 * هدر: X-Device-Token
 * بدنه: {
 *   requestId: string,           // شناسه‌ی درخواست از fileRequests در sync
 *   path: string,                // مسیری که لیست شده (مثلاً /storage/emulated/0)
 *   entries: [{name, path, isDir, size?, modifiedAt?, mimeType?}],
 *   error?: string               // اگر خطایی در گرفتن لیست رخ داد
 * }
 *
 * پاسخ: { ok, count }
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

  // پیدا کردن درخواست و بررسی تعلقش به همین دستگاه
  const fr = await db.fileRequest.findUnique({
    where: { id: requestId },
    select: { id: true, deviceId: true, type: true, status: true, path: true },
  });
  if (!fr || fr.deviceId !== device.id || fr.type !== "list") {
    return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });
  }

  const entriesRaw = Array.isArray(body?.entries) ? body.entries : null;
  const error = typeof body?.error === "string" ? body.error.slice(0, 300) : null;

  if (error) {
    await db.fileRequest.update({
      where: { id: requestId },
      data: { status: "ERROR", error, doneAt: new Date() },
    });
    return NextResponse.json({ ok: true, count: 0 });
  }

  if (!entriesRaw) {
    await db.fileRequest.update({
      where: { id: requestId },
      data: {
        status: "ERROR",
        error: "گوشی هیچ entryای نفرستاد",
        doneAt: new Date(),
      },
    });
    return NextResponse.json({ error: "entries لازم است" }, { status: 400 });
  }

  // محدودسازی هر entry و کل لیست (حداکثر ۲۰۰۰ entry)
  const entries = entriesRaw
    .filter(
      (e: any) =>
        e &&
        typeof e.name === "string" &&
        typeof e.path === "string" &&
        typeof e.isDir === "boolean"
    )
    .slice(0, 2000)
    .map((e: any) => ({
      name: String(e.name).slice(0, 200),
      path: String(e.path).slice(0, 500),
      isDir: Boolean(e.isDir),
      size: typeof e.size === "number" && Number.isFinite(e.size)
        ? Math.max(0, Math.min(2 ** 53 - 1, Math.round(e.size)))
        : null,
      modifiedAt: typeof e.modifiedAt === "number" && Number.isFinite(e.modifiedAt)
        ? new Date(e.modifiedAt)
        : null,
      mimeType: typeof e.mimeType === "string"
        ? e.mimeType.slice(0, 100)
        : null,
    }));

  await db.fileRequest.update({
    where: { id: requestId },
    data: {
      status: "DONE",
      listing: JSON.stringify(entries),
      error: null,
      doneAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, count: entries.length });
}
