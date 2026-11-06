import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "پنل مدیریت نگهبان",
  description:
    "پنل مدیریت اپلیکیشن کنترل سوژه - مشاهده لاگ کارکرد گوشی و لیست برنامه‌ها",
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%230A0E17" d="M12 2l7.5 3v5.8c0 5.1-3.1 9.2-7.5 11.2-4.4-2-7.5-6.1-7.5-11.2V5z"/><path fill="none" stroke="%238B7CFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8.5 12l2.5 2.5 5-4.5"/></svg>'
      ),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
