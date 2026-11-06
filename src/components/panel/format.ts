/** توابع قالب‌بندی فارسی برای پنل */

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function faDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** «۲ ساعت و ۳۰ دقیقه» */
export function fmtMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m === 0) return "۰ دقیقه";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${faDigits(r)} دقیقه`;
  if (r === 0) return `${faDigits(h)} ساعت`;
  return `${faDigits(h)} ساعت و ${faDigits(r)} دقیقه`;
}

/** «۲س ۳۰د» */
export function fmtMinutesShort(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${faDigits(r)} دقیقه`;
  if (r === 0) return `${faDigits(h)} ساعت`;
  return `${faDigits(h)}س ${faDigits(r)}د`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "هرگز";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "همین حالا";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${faDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${faDigits(days)} روز پیش`;
  return fmtDate(iso);
}

/** نام کوتاه روز هفته از کلید روز «YYYY-MM-DD» */
export function weekdayOfKey(dayKey: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(
      new Date(`${dayKey}T12:00:00.000Z`)
    );
  } catch {
    return dayKey.slice(5);
  }
}

/** «۲۸ مهر» از کلید روز */
export function dayLabelOfKey(dayKey: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      day: "numeric",
      month: "long",
    }).format(new Date(`${dayKey}T12:00:00.000Z`));
  } catch {
    return dayKey;
  }
}

/** «۱.۲ مگابایت» / «۸۵۰ کیلوبایت» / «۳۲ بایت» — برای نمایش حجم فایل */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return "—";
  if (bytes === 0) return faDigits(0) + " بایت";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  // تا ۲ رقم اعشار، با حذف صفرهای اضافه
  const formatted =
    idx === 0
      ? faDigits(value)
      : faDigits(value.toFixed(value < 10 ? 1 : 0).replace(/\.0$/, ""));
  return formatted + " " + units[idx];
}

/** کلید روز جاری «YYYY-MM-DD» بر اساس ساعت محلی مرورگر */
export function todayKey(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** N روز پیش */
export function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
