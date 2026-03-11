import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "resonance",
  description: "A P2P generative radio network and cultural simulation field.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-region="global">
      <body className={`${geistMono.variable} antialiased bg-background text-foreground selection:bg-highlight selection:text-background`}>
        {/* Electron Title Bar Drag Region Overlay */}
        <div style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} className="fixed top-0 left-0 right-0 h-[38px] z-50 cursor-default" />

        {children}
      </body>
    </html>
  );
}
