import type { Metadata } from "next";
import { Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider, THEME_PREFLIGHT_SCRIPT } from "@/components/app/ThemeProvider";
import { LangProvider } from "@/lib/i18n/LangProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const libre = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-libre",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Polaris | Your AI North Star for Academic Strategy",
  description:
    "Polaris is an AI academic strategist for bilingual, evidence-grounded global education planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_PREFLIGHT_SCRIPT }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`starfield antialiased ${inter.variable} ${libre.variable} font-sans`}
      >
        <SessionProvider>
          <ThemeProvider>
            <LangProvider>
              {children}
            </LangProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
