/** توابع کمکی برای تطبیق شماره تلفن‌ها */

/** فقط ارقام شماره را برمی‌گرداند */
export function phoneDigits(p: string): string {
  return p.replace(/\D/g, "");
}

/**
 * کلید تطبیق دو شماره: آخرین ۹ رقم (پوشش ۰۹۱۲... و +۹۸۹۱۲...)
 * اگر شماره کوتاه‌تر باشد همه ارقام برگردانده می‌شود.
 */
export function phoneKey(p: string): string {
  const d = phoneDigits(p);
  return d.length > 9 ? d.slice(-9) : d;
}
