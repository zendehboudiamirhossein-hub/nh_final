import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * فهرست اسکرین‌شات‌های اخیرِ یک دستگاه (metadata only — برای بارگذاری
 * زنده‌ی تصاویر از /api/admin/screen/[id]).
 * پارامتر ?take=N (پیش‌فرض ۲۴، حداکثر ۱۰۰).
 * پارامتر ?after=ISO برای دریافت فقط موارد جدیدتر از زمان مشخص (long-polling).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const url = new URL(req.url);
  const takeRaw = Number(url.searchParams.get("take") ?? "24");
  const take = Number.isFinite(takeRaw)
    ? Math.max(1, Math.min(100, Math.round(takeRaw)))
    : 24;
  const after = url.searchParams.get("after");
  const afterDate =
    after && /^\d{4}-\d{2}-\d{2}T/.test(after) ? new Date(after) : undefined;

  // تایید وجود دستگاه
  const exists = await db.device.findUnique({
    where: { id },
    select: {
      id: true,
      screenMonitorEnabled: true,
      screenMonitorStartedAt: true,
    },
  });
  if (!exists) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  const total = await db.screenCapture.count({ where: { deviceId: id } });

  const items = await db.screenCapture.findMany({
    where: {
      deviceId: id,
      ...(afterDate ? { takenAt: { gt: afterDate } } : {}),
    },
    orderBy: { takenAt: "desc" },
    take,
    select: { id: true, takenAt: true },
  });

  return NextResponse.json({
    enabled: exists.screenMonitorEnabled,
    startedAt: exists.screenMonitorStartedAt,
    total,
    items: items.map((s) => ({
      id: s.id,
      takenAt: s.takenAt,
    })),
  });
}
