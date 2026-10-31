import type { Metadata } from "next";
import Link from "next/link";
import { EXPORT_GUIDES } from "./export-guides";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Guides to sharing routes on ATTrails, including exporting GPX files from Strava, Komoot and AllTrails.",
};

export default function HelpPage() {
  return (
    <main className="px-4 py-8 sm:p-16">
      <article className="prose prose-attrails">
        <h1>Help</h1>

        <section aria-labelledby="export-heading">
          <h2 id="export-heading">Bring routes from other apps</h2>
          <p>
            ATTrails shares routes as GPX files. Most route and fitness apps can
            export one, and explain how in their own help:
          </p>
          <ul>
            {EXPORT_GUIDES.map((guide) => (
              <li key={guide.name}>
                <a href={guide.href}>Export a route from {guide.name}</a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="before-heading">
          <h2 id="before-heading">Before you share</h2>
          <ul>
            <li>
              Only share routes you made or have permission to share. See our{" "}
              <Link href="/terms">Terms of Service</Link>.
            </li>
            <li>
              Recorded activities often start and end at home. Check where your
              route starts and finishes, and leave out anything you&apos;d
              rather keep private.
            </li>
          </ul>
          <p>
            Once you have the GPX file, upload it with a name and a few details.
            It&apos;s saved to your own account.
          </p>
          <p className="not-prose">
            <Link className="btn btn-primary" href="/routes/new">
              Share a route
            </Link>
          </p>
        </section>

        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading">Still stuck?</h2>
          <p>
            Message{" "}
            <a href="https://bsky.app/profile/attrails.app">@attrails.app</a> on
            Bluesky, or open an issue on our GitHub{" "}
            <a href="https://github.com/haroldadmin/attrails">repository</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
