import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secure Smart Operations",
  description: "Internal CRM and ERP cockpit for Secure Smart",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
