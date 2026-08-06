import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Deal Tracker",
  description: "Internal deal-tracking platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="site-logo">
              Deal Tracker
            </Link>
            <Link href="/deals/new" className="btn btn-primary btn-sm">
              + New Deal
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
