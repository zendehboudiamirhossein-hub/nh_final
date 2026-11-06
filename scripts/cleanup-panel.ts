// پاک‌سازی داده‌های آزمایشی پنل نگهبان
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.eventLog.deleteMany({});
  await db.usageEntry.deleteMany({});
  await db.deviceApp.deleteMany({});
  await db.smsMessage.deleteMany({});
  await db.notificationItem.deleteMany({});
  await db.photoEntry.deleteMany({});
  await db.contactEntry.deleteMany({});
  await db.deviceCommand.deleteMany({});
  await db.capturePhoto.deleteMany({});
  await db.locationPing.deleteMany({});
  await db.device.deleteMany({});
  await db.pairingCode.deleteMany({});
  console.log(
    "پاک‌سازی کامل شد: دستگاه‌ها، برنامه‌ها، مصرف‌ها، پیامک‌ها، مخاطبین، اعلان‌ها، گالری، موقعیت‌ها، فرمان‌ها و عکس‌های دوربین، رویدادها و کدها حذف شدند"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
