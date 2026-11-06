import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * سرو یک اسکرین‌شات صفحه (JPEG) — فقط برای ادمین.
 * با ?download=1 به‌صورت فایل پیوست (دانلود) ارسال می‌شود.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const download = new URL(req.url).searchParams.get("download") === "1";

  const screen = await db.screenCapture.findUnique({
    where: { id },
    select: { jpeg: true, takenAt: true },
  });

  if (!screen?.jpeg) {
    return NextResponse.json({ error: "اسکرین‌شات موجود نیست" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "content-type": "image/jpeg",
    "cache-control": "no-store, max-age=0",
  };
  if (download) {
    const stamp = screen.takenAt
      ? new Date(screen.takenAt).toISOString().replace(/[:.]/g, "-")
      : "recent";
    headers["content-disposition"] =
      `attachment; filename="negahban-screen-${stamp.slice(0, 19)}.jpg"`;
  }

  return new NextResponse(new Uint8Array(screen.jpeg), { headers });
}
