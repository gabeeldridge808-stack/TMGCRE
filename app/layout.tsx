import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { logoutAction } from "@/app/login/actions";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Deal Tracker",
  description: "Internal deal-tracking platform",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Middleware guarantees a user is logged in on every route except
  // /login, so this is non-null everywhere except the login page itself
  // (where the header is intentionally hidden).
  const user = await getCurrentUser();

  return (
    <html lang="en" className={inter.variable}>
      <body>
        {user && (
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="site-logo">
                Deal Tracker
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {user.role === "admin" && (
                  <Link href="/admin/users" className="text-muted" style={{ fontSize: 13, textDecoration: "none" }}>
                    Users
                  </Link>
                )}
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {user.name}
                </span>
                <Link href="/deals/new" className="btn btn-primary btn-sm">
                  + New Deal
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Log out
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
