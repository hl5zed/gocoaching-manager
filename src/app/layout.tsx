import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "GoCoaching Manager",
  description: "GOThriveCoaching 코칭 관리 플랫폼",
  applicationName: "GoCoaching",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GoCoaching",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f6fa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
