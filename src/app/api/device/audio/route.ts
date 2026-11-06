import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-device-token");
  if (!token) return NextResponse.json({ error: "توکن دستگاه لازم است" }, { status: 401 });
  const device = await db.device.findUnique({ where: { token } });
  if (!device) return NextResponse.json({ error: "توکن نامعتبر است" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 }); }
  const audio = typeof body?.audio === "string" ? body.audio : null;
  if (!audio || audio.length === 0 || audio.length > 2_000_000)
    return NextResponse.json({ error: "فایل صوتی لازم است" }, { status: 400 });
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.slice(0, 50) : "audio/aac";
  const durationSec = typeof body?.durationSec === "number" && body.durationSec > 0 ? Math.round(body.durationSec) : 10;
  const at = new Date(typeof body?.at === "number" ? body.at : Date.now());
  if (!device.audioMonitorEnabled)
    return NextResponse.json({ ok: true, saved: 0, total: 0, reason: "monitor disabled" });
  const buf = Buffer.from(audio, "base64");
  if (buf.byteLength === 0) return NextResponse.json({ error: "فایل خالی است" }, { status: 400 });
  await db.$transaction(async (tx) => {
    await tx.audioClip.create({ data: { deviceId: device.id, audio: buf, mimeType, durationSec, recordedAt: at } });
    const keep = await tx.audioClip.findMany({ where: { deviceId: device.id }, orderBy: { recordedAt: "desc" }, take: 200, select: { id: true } });
    if (keep.length === 200) await tx.audioClip.deleteMany({ where: { deviceId: device.id, id: { notIn: keep.map(s => s.id) } } });
    await tx.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    await tx.eventLog.create({ data: { deviceId: device.id, type: "AUDIO", message: "قطعه‌ی صوتی دریافت شد" } });
  });
  const total = await db.audioClip.count({ where: { deviceId: device.id } });
  return NextResponse.json({ ok: true, saved: 1, total });
}
