# ---------- مرحله ساخت ----------
FROM oven/bun:1 AS builder
WORKDIR /app

# نصب وابستگی‌ها (با کش بهتر، اول فایل‌های manifest)
# از wildcard استفاده می‌کنیم تا اگر bun.lock موجود نبود هم بیلد خراب نشود
COPY package.json bun.lock* ./
RUN bun install

# کپی کد و ساخت
COPY . .
RUN bunx prisma generate && bunx next build

# ---------- مرحله اجرا ----------
FROM oven/bun:1 AS runner
WORKDIR /app

# فقط فایل‌های لازم برای اجرا را کپی می‌کنیم
COPY --from=builder /app ./

ENV NODE_ENV=production
# پوشه دیتابیس روی ولوم Railway
RUN mkdir -p /data

EXPOSE 3000

# اسکریپت استارت مقاوم: DATABASE_URL را تصحیح می‌کند، اسکیمای دیتابیس را اعمال
# می‌کند، سپس Next.js را روی پورت Railway بالا می‌آورد.
CMD ["sh", "start.sh"]
