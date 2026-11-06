#!/bin/sh
# اسکریپت استارت پنل نگهبان روی Railway
#
# این اسکریپت تضمین می‌کند که DATABASE_URL همیشه یک مسیر معتبر SQLite (file:)
# باشد. اگر Railway خودش DATABASE_URL را با چیزی غیر از file: پر کرده باشد
# (مثلاً اگه کاربر سرویس Postgres اضافه کرده باشد)، آن را نادیده می‌گیریم و
# از SQLite روی Volume استفاده می‌کنیم.
set -e

# پوشه Volume را مطمئن می‌سازیم که وجود دارد (اگر Volume وصل نباشد، باز هم
# برنامه بالا می‌آید ولی دیتابیس در همان کانتینر ذخیره می‌شود و با ری‌استارت
# از بین می‌رود).
mkdir -p /data

# بررسی و اعمال DATABASE_URL پیش‌فرض اگر لازم باشد
case "${DATABASE_URL:-}" in
  file:*)
    # مقدار فعلی معتبر است — همان نگه داشته می‌شود
    echo "[start] DATABASE_URL = $DATABASE_URL"
    ;;
  *)
    # یا خالی است یا پروتکل اشتباه دارد (postgres:// و غیره) — به SQLite روی Volume برمی‌گردیم
    export DATABASE_URL="file:/data/negahban.db"
    echo "[start] DATABASE_URL was empty or non-file; defaulting to $DATABASE_URL"
    ;;
esac

# اعمال اسکیمای دیتابیس (ایجاد فایل دیتابیس اگر وجود ندارد)
echo "[start] Running prisma db push..."
bunx prisma db push --accept-data-loss

# راه‌اندازی سرور Next.js روی پورت Railway (یا 3000 به‌عنوان پیش‌فرض)
echo "[start] Starting Next.js on port ${PORT:-3000}..."
exec bunx next start -p "${PORT:-3000}"
