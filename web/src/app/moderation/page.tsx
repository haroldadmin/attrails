import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderation",
  description:
    "How ATTrails moderates routes and reviews: limiting reach, not speech.",
};

export default function ModerationPage() {
  return (
    <main className="flex flex-col gap-10 px-4 py-8 sm:p-16">
      <hgroup className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl">Moderation</h1>
        <p className="text-lg">
          We want ATTrails to be a useful and welcoming place to find routes, so
          we moderate the routes and reviews that appear here.
        </p>
      </hgroup>

      <section aria-labelledby="reach-heading" className="flex flex-col gap-4">
        <h2 id="reach-heading" className="font-serif text-2xl">
          Reach, not speech
        </h2>
        <p>
          Like the rest of the{" "}
          <a className="link link-primary" href="https://atproto.com">
            AT Protocol
          </a>{" "}
          ecosystem, moderation on ATTrails limits reach, not speech. When a
          route or review is flagged, we stop showing it in public places like
          the homepage and a route&apos;s reviews. Its author can still see it,
          and we let them know it was flagged.
        </p>
      </section>

      <section
        aria-labelledby="ownership-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="ownership-heading" className="font-serif text-2xl">
          Your data stays yours
        </h2>
        <p>
          Routes and reviews are saved to your own account, not to ATTrails. We
          only index them so we can show them here.
        </p>
        <p>
          That means moderation only changes what ATTrails shows. We can&apos;t
          edit or delete records from anyone&apos;s account, and other apps may
          make their own choices about what to show.
        </p>
      </section>

      <section
        aria-labelledby="contact-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="contact-heading" className="font-serif text-2xl">
          Something look wrong?
        </h2>
        <p>
          If something was flagged that shouldn&apos;t have been, or you come
          across something that should be, mention{" "}
          <a
            className="link link-primary"
            href="https://bsky.app/profile/attrails.app"
          >
            @attrails.app
          </a>{" "}
          on Bluesky.
        </p>
      </section>
    </main>
  );
}
