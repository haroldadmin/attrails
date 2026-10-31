import type { Metadata } from "next";
import Link from "next/link";
import { EXPORT_SOURCES, exportGuideHref } from "./export/sources";

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
            export one:
          </p>
          <ul>
            {EXPORT_SOURCES.map((source) => (
              <li key={source.slug}>
                <Link href={exportGuideHref(source)}>
                  Export a route from {source.name}
                </Link>
              </li>
            ))}
          </ul>
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
