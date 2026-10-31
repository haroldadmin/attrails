import type { Metadata } from "next";
import Link from "next/link";
import { EXPORT_GUIDES } from "./export-guides";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about ATTrails: how it works, who owns your data, and how to get help.",
};

export default function FaqPage() {
  return (
    <main className="px-4 py-8 sm:p-16">
      <article className="prose prose-attrails">
        <hgroup>
          <h1>Frequently asked questions</h1>
          <p className="lead">
            How ATTrails works, what happens to your data, and where to get
            help.
          </p>
        </hgroup>

        <section aria-labelledby="decentralised">
          <h2 id="decentralised">How is ATTrails decentralised?</h2>
          <p>
            ATTrails is built on the{" "}
            <a href="https://atproto.com" target="_blank" rel="noopener">
              AT Protocol
            </a>
            , an open network for social apps. Your account lives on a Personal
            Data Server (PDS), run by a provider you choose or by yourself.
          </p>
          <p>
            Routes and reviews are saved to your account and published to the
            network. ATTrails reads them from the network and indexes them so it
            can show, search and map them. Any other app can do the same, so no
            single app controls them.
          </p>
        </section>

        <section aria-labelledby="data-ownership">
          <h2 id="data-ownership">Who owns my routes and reviews?</h2>
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
        </section>

        <section aria-labelledby="export-from-other-apps">
          <h2 id="export-from-other-apps">
            How do I share a route from Strava, Komoot or AllTrails?
          </h2>
          <p>
            ATTrails supports GPX files for routes. Most route and fitness apps
            can export one, and explain how in their own help:
          </p>
          <ul>
            {EXPORT_GUIDES.map((guide) => (
              <li key={guide.name}>
                <a href={guide.href} target="_blank" rel="noopener">
                  Export a route from {guide.name}
                </a>
              </li>
            ))}
          </ul>
          <p>
            Then upload the file on the{" "}
            <Link href="/routes/new">Share a route</Link> page.
          </p>
        </section>

        <section aria-labelledby="report-issues">
          <h2 id="report-issues">How do I report a problem?</h2>
          <p>
            For bugs and feedback, message{" "}
            <a
              href="https://bsky.app/profile/attrails.app"
              target="_blank"
              rel="noopener"
            >
              @attrails.app
            </a>{" "}
            on Bluesky, or open an issue on our{" "}
            <a
              href="https://github.com/haroldadmin/attrails/issues"
              target="_blank"
              rel="noopener"
            >
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
            <a
              href="https://github.com/haroldadmin/attrails/security/advisories/new"
              target="_blank"
              rel="noopener"
            >
              GitHub&apos;s private vulnerability reporting
            </a>
            , not in a public issue.
          </p>
        </section>
      </article>
    </main>
  );
}
