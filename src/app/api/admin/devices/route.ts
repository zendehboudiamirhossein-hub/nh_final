import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";
import { dayKeyToStart, daysAgoKey, todayKey } from "@/lib/days";

/** فهرست دستگاه‌ها با آمار خلاصه */
export async function GET() {
  if (!(await isAdminRequest())) return unauthorizedResponse();

  const devices = await db.device.findMany({
    orderBy: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { _count: { select: { apps: true } } },
  });

  const todayStart = dayKeyToStart(todayKey());
  const weekStart = dayKeyToStart(daysAgoKey(6));

  const [todayAgg, weekAgg, controlledAgg] = await Promise.all([
    db.usageEntry.groupBy({
      by: ["deviceId"],
      where: { day: todayStart },
      _sum: { minutes: true },
    }),
    db.usageEntry.groupBy({
      by: ["deviceId"],
      where: { day: { gte: weekStart } },
      _sum: { minutes: true },
    }),
    db.deviceApp.groupBy({
      by: ["deviceId"],
      where: { controlled: true },
      _count: { _all: true },
    }),
  ]);

  const todayMap = new Map(todayAgg.map((g) => [g.deviceId, g._sum.minutes ?? 0]));
  const weekMap = new Map(weekAgg.map((g) => [g.deviceId, g._sum.minutes ?? 0]));
  const controlledMap = new Map(controlledAgg.map((g) => [g.deviceId, g._count._all]));

  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      model: d.model,
      androidVersion: d.androidVersion,
      appVersion: d.appVersion,
      battery: d.battery,
      lastSeenAt: d.lastSeenAt,
      lastSyncAt: d.lastSyncAt,
      createdAt: d.createdAt,
      appCount: d._count.apps,
      controlledCount: controlledMap.get(d.id) ?? 0,
      todayMinutes: todayMap.get(d.id) ?? 0,
      weekMinutes: weekMap.get(d.id) ?? 0,
    })),
  });
}
