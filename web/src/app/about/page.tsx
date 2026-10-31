import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "ATTrails is a place to discover and share cycling, running, and hiking routes on the open social web.",
};

export default function AboutPage() {
  return (
    <main className="px-4 py-8 sm:p-16">
      <article className="prose prose-attrails">
        <hgroup>
          <h1>About ATTrails</h1>
          <p className="lead">
            ATTrails is a place to discover and share cycling, running, and
            hiking routes on the open social web.
          </p>
        </hgroup>

        <section aria-labelledby="features-heading">
          <h2 id="features-heading">What you can do</h2>
          <ul>
            <li>Share your favourite routes by uploading GPX files.</li>
            <li>Discover routes shared by others.</li>
            <li>
              Review routes you&apos;ve tried and build your own collection.
            </li>
          </ul>
        </section>

        <section aria-labelledby="data-heading">
          <h2 id="data-heading">Your data, your account</h2>
          <p>
            ATTrails is built on the{" "}
            <a href="https://atproto.com">AT Protocol</a>. You log in with your
            Bluesky handle, or the handle of any other AT Protocol account.
            There&apos;s no separate ATTrails account to create.
          </p>
          <p>
            Routes and reviews are saved to your own account as public records,
            not to ATTrails. Anyone can see them, other apps can use them, and
            you can edit or delete them whenever you like.
          </p>
        </section>

        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading">Get in touch</h2>
          <p>
            Questions, feedback, or found a bug? Reach out to{" "}
            <a href="https://bsky.app/profile/attrails.app">@attrails.app</a> on
            Bluesky.
          </p>
          <p>
            You can also open an issue on our Github{" "}
            <a href="https://github.com/haroldadmin/attrails">repository</a>.
          </p>
        </section>

        <p className="not-prose mt-10 flex flex-row flex-wrap gap-6">
          <Link className="btn btn-primary" href="/">
            Discover routes
          </Link>
          <Link className="btn btn-outline" href="/routes/new">
            Share a route
          </Link>
        </p>
      </article>
    </main>
  );
}
