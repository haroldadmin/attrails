import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/footer";
import { TopNav } from "@/components/top-nav";
import { openGraphDefaults, SITE_URL } from "./shared-metadata";
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

const HOME_TITLE = "ATTrails · Running, cycling & hiking routes on ATProto";

const DESCRIPTION =
  "Discover and share cycling, running, and hiking routes on the open social web.";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: HOME_TITLE, template: "%s · ATTrails" },
  description: DESCRIPTION,
  openGraph: {
    ...openGraphDefaults,
    title: HOME_TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
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
          <TopNav />
        </header>
        <div className="grow w-full max-w-7xl mx-auto">{children}</div>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}

function Analytics() {
  const src = process.env.ATTRAILS_UMAMI_SCRIPT_URL;
  const websiteId = process.env.ATTRAILS_UMAMI_WEBSITE_ID;
  if (!src || !websiteId) {
    return null;
  }

  return (
    <Script
      src={src}
      data-website-id={websiteId}
      data-domains={SITE_URL.hostname}
      data-do-not-track="true"
      strategy="afterInteractive"
    />
  );
}
