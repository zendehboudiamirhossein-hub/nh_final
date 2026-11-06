import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * ثبت فرمان جدید برای دستگاه (فعلاً فقط عکس‌برداری).
 * بدنه: { type: "capture" }
 * اگر همین حالا فرمان در انتظاری وجود داشته باشد، دوباره ساخته نمی‌شود.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (body?.type !== "capture") {
    return NextResponse.json({ error: "نوع فرمان نامعتبر است" }, { status: 400 });
  }

  const device = await db.device.findUnique({ where: { id }, select: { id: true } });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  // جلوگیری از انباشت: اگر همین حالا فرمان در انتظار است، همان را برگردان
  const existing = await db.deviceCommand.findFirst({
    where: { deviceId: id, status: "PENDING", type: "CAPTURE" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, existing: true });
  }

  const cmd = await db.deviceCommand.create({
    data: { deviceId: id, type: "CAPTURE" },
  });

  return NextResponse.json({ ok: true, id: cmd.id, existing: false });
}
