import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { Footer } from "@/components/footer";
import { AtTrailsLogo } from "@/components/logo";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ATTrails",
  description:
    "Discover and share cycling, running, and hiking routes on the open social web.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="attrails"
      className={`${newsreader.variable} ${sourceSans.variable}`}
    >
      <body className="min-h-lvh flex flex-col font-sans">
        <header className="w-full max-w-7xl mx-auto px-4 sm:px-16">
          <div className="flex flex-row justify-between items-baseline gap-8 border-b border-base-300">
            <AtTrailsLogo size="large" />
            <TopNav />
          </div>
        </header>
        <div className="grow w-full max-w-7xl mx-auto">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
