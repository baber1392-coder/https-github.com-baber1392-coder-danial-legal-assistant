import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "دستیار جامع اختصاصی دانیال",
  description: "سامانه خصوصی مدیریت دفتر وکالت، پرونده‌ها و پژوهش حقوقی",
  manifest: "/manifest.webmanifest",
  applicationName: "دستیار دانیال",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "دانیال" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}