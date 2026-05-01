import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "GoCoaching Manager",
  description: "Phase 0 scaffold for GOThriveCoaching management workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
