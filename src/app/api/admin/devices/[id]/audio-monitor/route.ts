import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;
  if (enabled === null) return NextResponse.json({ error: "بدنه‌ی { enabled: true|false } لازم است" }, { status: 400 });
  const device = await db.device.findUnique({ where: { id }, select: { id: true, audioMonitorEnabled: true } });
  if (!device) return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  const now = new Date();
  if (device.audioMonitorEnabled !== enabled) {
    await db.$transaction(async (tx) => {
      await tx.device.update({ where: { id }, data: { audioMonitorEnabled: enabled, audioMonitorStartedAt: enabled ? now : null } });
      await tx.eventLog.create({ data: { deviceId: id, type: "AUDIO", message: enabled ? "ضبط صدا روشن شد" : "ضبط صدا خاموش شد" } });
    });
  }
  return NextResponse.json({ ok: true, enabled, startedAt: enabled ? now.toISOString() : null });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;
  const device = await db.device.findUnique({ where: { id }, select: { audioMonitorEnabled: true, audioMonitorStartedAt: true, _count: { select: { audioClips: true } } } });
  if (!device) return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  const last = await db.audioClip.findFirst({ where: { deviceId: id }, orderBy: { recordedAt: "desc" }, select: { id: true, recordedAt: true } });
  return NextResponse.json({ enabled: device.audioMonitorEnabled, startedAt: device.audioMonitorStartedAt, totalCaptured: device._count.audioClips, lastCapture: last ? { id: last.id, recordedAt: last.recordedAt } : null });
}
