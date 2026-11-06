/** ابزارهای مشترک API — کلید روز به شکل YYYY-MM-DD */

export function isValidDayKey(day: unknown): day is string {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);
}

/** «2026-10-20» → نیمه‌شب UTC همان روز (برای کلید یکتای مصرف روزانه) */
export function dayKeyToStart(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** کلید روز جاری سرور */
export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** کلید N روز پیش */
export function daysAgoKey(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
