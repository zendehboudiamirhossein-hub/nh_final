import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;
  const download = new URL(req.url).searchParams.get("download") === "1";
  const clip = await db.audioClip.findUnique({ where: { id }, select: { audio: true, mimeType: true, recordedAt: true } });
  if (!clip?.audio) return NextResponse.json({ error: "قطعه‌ی صوتی موجود نیست" }, { status: 404 });
  const headers: Record<string, string> = { "content-type": clip.mimeType || "audio/aac", "cache-control": "no-store, max-age=0" };
  if (download) { const stamp = clip.recordedAt ? new Date(clip.recordedAt).toISOString().replace(/[:.]/g, "-") : "recent"; headers["content-disposition"] = `attachment; filename="negahban-audio-${stamp.slice(0,19)}.aac"`; }
  return new NextResponse(new Uint8Array(clip.audio as Uint8Array), { headers });
}
