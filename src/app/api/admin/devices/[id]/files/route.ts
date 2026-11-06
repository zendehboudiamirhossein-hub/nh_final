import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * GET: دریافت لیست فایل‌ها برای یک درخواست «list» تکمیل‌شده.
 * پارامتر: ?requestId=X
 *
 * پاسخ: {
 *   path: string,
 *   entries: [{name, path, isDir, size?, modifiedAt?, mimeType?}]
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

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
      status: true,
      path: true,
      listing: true,
      error: true,
      doneAt: true,
    },
  });

  if (!fr || fr.deviceId !== id) {
    return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  }
  if (fr.type !== "list") {
    return NextResponse.json({ error: "این درخواست از نوع list نیست" }, { status: 400 });
  }

  let entries: any[] = [];
  if (fr.status === "DONE" && fr.listing) {
    try {
      entries = JSON.parse(fr.listing);
    } catch {
      entries = [];
    }
  }

  return NextResponse.json({
    ok: true,
    requestId: fr.id,
    path: fr.path,
    status: fr.status,
    error: fr.error,
    doneAt: fr.doneAt,
    entries,
  });
}
