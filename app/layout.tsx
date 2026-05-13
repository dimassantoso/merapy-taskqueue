import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kapynis Task Queue Dashboard",
  description: "Monitor and manage kapynis task queue jobs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 hover:opacity-80">
              <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">K</span>
              </div>
              <span className="font-semibold text-gray-800">Kapynis Task Queue</span>
            </a>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <a href="/" className="hover:text-indigo-600">Dashboard</a>
          </div>
        </nav>
        <main className="p-6 max-w-7xl mx-auto">
          <Suspense>{children}</Suspense>
        </main>
      </body>
    </html>
  );
}
