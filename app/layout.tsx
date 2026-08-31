import type { Metadata } from "next";
import {
  Hind_Siliguri,
  Inter,
  Libre_Baskerville,
  Noto_Serif_Bengali,
} from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { SmoothScroll } from "@/lib/animations/SmoothScroll";
import { ThemeProvider, THEME_PREFLIGHT_SCRIPT } from "@/components/app/ThemeProvider";

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

const bangla = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bangla",
  display: "swap",
});

const banglaSerif = Noto_Serif_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bangla-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  applicationName: "Polaris",
  title: {
    default: "Polaris — Your Academic North Star",
    template: "%s | Polaris",
  },
  description:
    "Polaris turns academic goals, evidence, deadlines, and daily work into one clear, bilingual strategy.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Polaris",
    title: "Polaris — Your Academic North Star",
    description: "One clear strategy for ambitious students: goals, evidence, deadlines, and daily action.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Polaris — Your Academic North Star",
    description: "One clear strategy for ambitious students: goals, evidence, deadlines, and daily action.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preflight: set data-theme before hydration to avoid a flash.
            suppressHydrationWarning because some Chrome extensions inject
            attributes/content into <script> tags before React hydrates. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_PREFLIGHT_SCRIPT }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`starfield antialiased ${inter.variable} ${libre.variable} ${bangla.variable} ${banglaSerif.variable} font-sans`}
      >
        <SessionProvider>
          <ThemeProvider>
            <SmoothScroll>
              <LangProvider>{children}</LangProvider>
            </SmoothScroll>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
