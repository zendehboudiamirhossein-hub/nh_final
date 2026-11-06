import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";
import { phoneKey } from "@/lib/phone";

/**
 * خروجی CSV برای ادمین (قابل باز شدن در اکسل فارسی):
 *   ?kind=sms      — پیامک‌ها (با فیلتر جستجو q و نوع type=all|in|out)
 *   ?kind=contacts — مخاطبین (با فیلتر جستجو q)
 */

/** یک سلول CSV: نقل‌قول‌گذاری + جلوگیری از تفسیر به‌عنوان فرمول در اکسل */
function csvCell(value: string | null | undefined): string {
  let v = String(value ?? "");
  if (/^[=+\-@\r\n]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}

function csvDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) return unauthorizedResponse();
  const { id } = await params;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "contacts" ? "contacts" : "sms";
  const q = (url.searchParams.get("q") ?? "").trim();
  const typeParam = url.searchParams.get("type") ?? "all";
  const type = ["all", "in", "out"].includes(typeParam) ? typeParam : "all";

  const device = await db.device.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!device) {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }

  let header: string[];
  let rows: string[][];
  let asciiName: string;

  if (kind === "contacts") {
    const all = await db.contactEntry.findMany({
      where: { deviceId: id },
      orderBy: { name: "asc" },
      take: 5000,
    });
    const qDigits = q.replace(/\D/g, "");
    header = ["نام مخاطب", "شماره(ها)"];
    rows = all
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.includes(q) ||
          c.phones.includes(q) ||
          (qDigits.length >= 3 && c.phones.replace(/\D/g, "").includes(qDigits))
        );
      })
      .map((c) => [c.name, c.phones]);
    asciiName = "negahban-contacts";
  } else {
    const [all, contacts] = await Promise.all([
      db.smsMessage.findMany({
        where: { deviceId: id },
        orderBy: { at: "desc" },
        take: 5000,
      }),
      db.contactEntry.findMany({
        where: { deviceId: id },
        select: { name: true, phones: true },
      }),
    ]);

    // نقشه کلید شماره → نام مخاطب
    const nameByKey = new Map<string, string>();
    for (const c of contacts) {
      for (const p of c.phones.split("، ")) {
        nameByKey.set(phoneKey(p), c.name);
      }
    }
    const nameOf = (address: string) => nameByKey.get(phoneKey(address)) ?? "";

    header = ["تاریخ و ساعت", "شماره", "مخاطب", "نوع", "متن پیام"];
    const qDigits = q.replace(/\D/g, "");
    rows = all
      .filter((s) =>
        type === "in" ? s.type === 1 : type === "out" ? s.type === 2 : true
      )
      .filter((s) => {
        if (!q) return true;
        // هم‌تراز با جستجوی فرانت‌اند (device-detail.tsx filteredSms):
        // تطبیق مستقیم روی address/body/id/نام + تطبیق دیجیت‌محور روی شماره
        const direct =
          s.address.includes(q) ||
          s.body.includes(q) ||
          String(s.smsId).includes(q) ||
          nameOf(s.address).includes(q);
        const byDigits =
          qDigits.length >= 3 &&
          s.address.replace(/\D/g, "").includes(qDigits);
        return direct || byDigits;
      })
      .map((s) => [
        csvDate(s.at),
        s.address,
        nameOf(s.address),
        s.type === 1 ? "دریافتی" : s.type === 2 ? "ارسالی" : "دیگر",
        s.body,
      ]);
    asciiName = "negahban-sms";
  }

  // BOM برای نمایش درست فارسی در اکسل + CRLF
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  const csv = "\uFEFF" + lines.join("\r\n");
  const faName = `نگهبان-${kind === "contacts" ? "مخاطبین" : "پیامک‌ها"}-${device.name}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${asciiName}.csv"; filename*=UTF-8''${encodeURIComponent(faName)}`,
      "cache-control": "no-store",
    },
  });
}
