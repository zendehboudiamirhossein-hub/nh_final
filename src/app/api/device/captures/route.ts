import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * دریافت نتیجه‌ی فرمان‌های عکس‌برداری (عکس دوربین جلو).
 * هدر: X-Device-Token
 * بدنه: { captures: [{ commandId, image (base64), at }] }
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-device-token");
  if (!token) {
    return NextResponse.json({ error: "توکن دستگاه لازم است" }, { status: 401 });
  }

  const device = await db.device.findUnique({ where: { token } });
  if (!device) {
    return NextResponse.json({ error: "توکن نامعتبر است" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });
  }

  const rawCaps = Array.isArray(body?.captures) ? body.captures : null;
  const caps = rawCaps
    ? rawCaps
        .filter(
          (c): c is { commandId: string; image: string; at: number } =>
            typeof c?.commandId === "string" &&
            c.commandId.length > 0 &&
            c.commandId.length <= 40 &&
            typeof c?.image === "string" &&
            c.image.length > 0 &&
            c.image.length <= 900_000 &&
            Number.isFinite(c?.at)
        )
        .slice(0, 5)
        .map((c) => ({
          commandId: c.commandId,
          image: c.image,
          at: new Date(c.at),
        }))
    : null;

  if (!caps || caps.length === 0) {
    return NextResponse.json({ error: "عکسی برای ذخیره نیست" }, { status: 400 });
  }

  let saved = 0;
  await db.$transaction(async (tx) => {
    for (const cap of caps) {
      const buf = Buffer.from(cap.image, "base64");
      if (buf.byteLength === 0) continue;

      // فرمان باید متعلق به همین دستگاه و در وضعیت PENDING باشد
      const cmd = await tx.deviceCommand.findFirst({
        where: {
          id: cap.commandId,
          deviceId: device.id,
          status: "PENDING",
          type: "CAPTURE",
        },
      });

      await tx.capturePhoto.create({
        data: {
          deviceId: device.id,
          commandId: cmd ? cap.commandId : null,
          jpeg: buf,
          takenAt: cap.at,
        },
      });

      if (cmd) {
        await tx.deviceCommand.update({
          where: { id: cap.commandId },
          data: { status: "DONE", doneAt: new Date() },
        });
      }
      saved++;
    }

    if (saved > 0) {
      await tx.eventLog.create({
        data: {
          deviceId: device.id,
          type: "CAPTURE",
          message: "عکس دوربین: " + saved + " مورد دریافت شد",
        },
      });
    }
  });

  return NextResponse.json({ ok: true, saved });
}
