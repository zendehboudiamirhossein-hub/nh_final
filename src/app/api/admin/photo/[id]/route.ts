import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * سرو تصویر یک عکس گالری (JPEG فشرده) — فقط برای ادمین.
 * با ?download=1 به‌صورت فایل پیوست (دانلود) ارسال می‌شود.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const download = new URL(req.url).searchParams.get("download") === "1";

  const photo = await db.photoEntry.findUnique({
    where: { id },
    select: { thumb: true, mediaId: true },
  });

  if (!photo?.thumb) {
    return NextResponse.json({ error: "پیش‌نمایش موجود نیست" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "content-type": "image/jpeg",
  };
  if (download) {
    headers["content-disposition"] =
      `attachment; filename="negahban-photo-${photo.mediaId}.jpg"`;
  } else {
    headers["cache-control"] = "private, max-age=86400";
  }

  return new NextResponse(new Uint8Array(photo.thumb), { headers });
}
