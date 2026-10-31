import type { Metadata } from "next";
import Link from "next/link";
import { EXPORT_GUIDES } from "./export-guides";
import { FaqItem } from "./faq-item";
import { OpenLinkedFaq } from "./open-linked-faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about ATTrails: how it works, who owns your data, and how to get help.",
};

export default function FaqPage() {
  return (
    <main className="flex flex-col gap-8 px-4 py-8 sm:p-16">
      <div className="prose prose-attrails">
        <h1>Frequently asked questions</h1>
      </div>

      <div className="flex max-w-prose flex-col gap-2">
        <FaqItem id="decentralised" question="How is ATTrails decentralised?">
          <p>
            ATTrails is built on the{" "}
            <a href="https://atproto.com">AT Protocol</a>, the open network
            behind Bluesky. Your account lives on a Personal Data Server (PDS):
            Bluesky&apos;s, another provider&apos;s, or one you run yourself.
          </p>
          <p>
            Routes and reviews are saved to your account and published to the
            network. ATTrails reads them from the network and indexes them so it
            can show, search and map them. Any other app can do the same, so no
            single app controls them.
          </p>
        </FaqItem>

        <FaqItem id="data-ownership" question="Who owns my routes and reviews?">
          <p>
            You do. They&apos;re saved to your own account, not to ATTrails. You
            can edit or delete them whenever you like, and the changes reach
            ATTrails automatically.
          </p>
          <p>
            If you move your account to a different PDS, your routes and reviews
            move with it. If ATTrails went away, they&apos;d stay in your
            account. Our <Link href="/privacy">Privacy Policy</Link> explains
            what ATTrails itself keeps.
          </p>
        </FaqItem>

        <FaqItem
          id="export-from-other-apps"
          question="How do I share a route from Strava, Komoot or AllTrails?"
        >
          <p>
            ATTrails supports GPX files for routes. Most route and fitness apps
            can export one, and explain how in their own help:
          </p>
          <ul>
            {EXPORT_GUIDES.map((guide) => (
              <li key={guide.name}>
                <a href={guide.href}>Export a route from {guide.name}</a>
              </li>
            ))}
          </ul>
          <p>
            Then upload the file on the{" "}
            <Link href="/routes/new">Share a route</Link> page.
          </p>
        </FaqItem>

        <FaqItem id="report-issues" question="How do I report a problem?">
          <p>
            For bugs and feedback, message{" "}
            <a href="https://bsky.app/profile/attrails.app">@attrails.app</a> on
            Bluesky, or open an issue on our{" "}
            <a href="https://github.com/haroldadmin/attrails/issues">
              GitHub repository
            </a>
            .
          </p>
          <p>
            To flag a route or review, mention @attrails.app on Bluesky. Our{" "}
            <Link href="/moderation">moderation page</Link> explains what
            happens next.
          </p>
          <p>
            Please report security vulnerabilities privately, through{" "}
            <a href="https://github.com/haroldadmin/attrails/security/advisories/new">
              GitHub&apos;s private vulnerability reporting
            </a>
            , not in a public issue.
          </p>
        </FaqItem>
      </div>

      <OpenLinkedFaq />
    </main>
  );
}
