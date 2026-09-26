import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/common/Toast";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/common/ThemeProvider";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Discord Points Manager",
  description: "Admin dashboard for tracking Discord user points across weekly events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>
            <main className="flex-1">{children}</main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
