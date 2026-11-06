import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * سرو تصویر یک عکس دوربین جلو (JPEG فشرده) — فقط برای ادمین.
 * با ?download=1 به‌صورت فایل پیوست (دانلود) ارسال می‌شود.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const download = new URL(req.url).searchParams.get("download") === "1";

  const capture = await db.capturePhoto.findUnique({
    where: { id },
    select: { jpeg: true, takenAt: true },
  });

  if (!capture?.jpeg) {
    return NextResponse.json({ error: "عکس موجود نیست" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "content-type": "image/jpeg",
  };
  if (download) {
    const stamp = capture.takenAt
      ? new Date(capture.takenAt).toISOString().replace(/[:.]/g, "-")
      : "recent";
    headers["content-disposition"] =
      `attachment; filename="negahban-capture-${stamp.slice(0, 19)}.jpg"`;
  } else {
    headers["cache-control"] = "private, max-age=86400";
  }

  return new NextResponse(new Uint8Array(capture.jpeg), { headers });
}
