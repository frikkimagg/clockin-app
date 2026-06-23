import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clock — Time Tracking",
  description: "PIN-based clock-in for the team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
