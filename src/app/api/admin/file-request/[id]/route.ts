import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * GET: دریافت محتوای فایل دانلود‌شده از گوشی.
 * این endpoint فایل کامل (که دستگاه chunk به chunk فرستاده) را به‌صورت
 * باینری برمی‌گرداند تا ادمین آن را روی کامپیوتر خود ذخیره کند.
 *
 * با ?download=1 به‌صورت attachment (force download) ارسال می‌شود.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const fr = await db.fileRequest.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      status: true,
      content: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      path: true,
    },
  });

  if (!fr || fr.type !== "download") {
    return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });
  }
  if (fr.status !== "DONE") {
    return NextResponse.json(
      { error: "دانلود هنوز تکمیل نشده", status: fr.status },
      { status: 409 }
    );
  }
  if (!fr.content) {
    return NextResponse.json({ error: "محتوای فایل موجود نیست" }, { status: 404 });
  }

  // نام فایل: اگر در chunk اول تعیین شده، از آن استفاده کن؛ وگرنه از path
  const fileName = fr.fileName || fr.path.split("/").pop() || "file.bin";
  const mimeType = fr.mimeType || "application/octet-stream";
  // همیشه از طول واقعی محتوای ذخیره‌شده استفاده کن، نه از fileSize اعلامی
  // دستگاه. اگر fileSize نادرست باشد یا فایل در حین ارسال تغییر کرده باشد،
  // Content-Length باید با محتوای واقعی هم‌خوانی داشته باشد تا دانلود کامل
  // یا کوتاه‌نشده باشد.
  const size = fr.content.byteLength;

  const download = new URL(req.url).searchParams.get("download") === "1";

  const headers: Record<string, string> = {
    "content-type": mimeType,
    "content-length": String(size),
    "cache-control": "no-store",
  };
  if (download) {
    headers["content-disposition"] =
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  } else {
    headers["content-disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  }

  return new NextResponse(new Uint8Array(fr.content as Uint8Array), { headers });
}

/**
 * DELETE: حذف محتوای ذخیره‌شده (آزادسازی فضای دیتابیس).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  await db.fileRequest.update({
    where: { id },
    data: {
      content: null,
      // status را به ERROR تبدیل کن تا دیگه قابل دانلود نباشه
      status: "ERROR",
      error: "محتوای فایل توسط ادمین حذف شد",
    },
  });

  return NextResponse.json({ ok: true });
}
