import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/footer";
import { AtTrailsLogo } from "@/components/logo";
import { TopNav } from "@/components/top-nav";
import { openGraphDefaults } from "./shared-metadata";
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
  title: { default: "ATTrails", template: "%s · ATTrails" },
  description:
    "Discover and share cycling, running, and hiking routes on the open social web.",
  openGraph: openGraphDefaults,
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
          <div className="flex flex-row flex-wrap items-center gap-x-8 gap-y-2 py-3 border-b border-base-300">
            <AtTrailsLogo size="large" />
            <TopNav />
          </div>
        </header>
        <div className="grow w-full max-w-7xl mx-auto">{children}</div>
        <Footer />
        <Script
          src="https://umami.haroldadmin.cloud/script.js"
          data-website-id="95221821-af97-4846-b809-43bf20cb01fc"
          data-domains="www.attrails.app"
          data-do-not-track="true"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
