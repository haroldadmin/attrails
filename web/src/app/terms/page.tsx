import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using ATTrails.",
};

export default function TermsPage() {
  return (
    <main className="px-4 py-8 sm:p-16">
      <article className="prose prose-attrails">
        <hgroup>
          <h1>Terms of Service</h1>
          <p>
            Last updated <time dateTime="2026-10-27">27 October 2026</time>
          </p>
        </hgroup>

        <section aria-labelledby="about-heading">
          <h2 id="about-heading">About these terms</h2>
          <p>
            ATTrails (attrails.app) is run by{" "}
            <a href="https://bsky.app/profile/haroldadmin.com">
              @haroldadmin.com
            </a>
            , an individual based in the United Kingdom (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;). By using ATTrails, you agree to these terms. Our{" "}
            <Link href="/privacy">Privacy Policy</Link> explains how we handle
            your data.
          </p>
        </section>

        <section aria-labelledby="eligibility-heading">
          <h2 id="eligibility-heading">Who can use ATTrails</h2>
          <p>
            You must be at least 13 years old to sign in to ATTrails. If
            you&apos;re under 18, make sure a parent or guardian is happy for
            you to use it.
          </p>
        </section>

        <section aria-labelledby="account-heading">
          <h2 id="account-heading">Your account</h2>
          <p>
            You sign in with an AT Protocol account, such as a Bluesky account.
            That account is provided by your Personal Data Server (PDS), not by
            ATTrails, and its provider&apos;s terms also apply. You&apos;re
            responsible for activity on ATTrails that happens through your
            account.
          </p>
        </section>

        <section aria-labelledby="content-heading">
          <h2 id="content-heading">Your content</h2>
          <p>
            You own the routes, GPX files and reviews you create. They&apos;re
            saved to your account as public records, which anyone, including
            other apps, can see and use.
          </p>
          <p>
            So we can run ATTrails, you give us a worldwide, non-exclusive,
            royalty-free licence to store, index, process, display and
            distribute your content as part of the service, for example to show
            it on maps, in search results, in previews and when shared. This
            licence ends when you delete the content, except for copies we keep
            as described in our Privacy Policy.
          </p>
          <p>
            You confirm you have the right to share what you post. Don&apos;t
            upload routes or tracks that you don&apos;t have permission to
            publish, or that reveal private information such as where someone
            lives without their consent.
          </p>
        </section>

        <section aria-labelledby="conduct-heading">
          <h2 id="conduct-heading">Acceptable use</h2>
          <p>Please don&apos;t use ATTrails to:</p>
          <ul>
            <li>
              post anything illegal, hateful, harassing or sexually explicit;
            </li>
            <li>
              share routes that encourage trespassing or dangerous or illegal
              activity;
            </li>
            <li>spam, mislead, or impersonate other people;</li>
            <li>
              interfere with ATTrails, for example by attacking, overloading, or
              scraping it in a way that harms the service.
            </li>
          </ul>
          <p>
            We <Link href="/moderation">moderate</Link> what appears on
            ATTrails, and may hide content or stop you from signing in if you
            break these terms.
          </p>
        </section>

        <section aria-labelledby="safety-heading">
          <h2 id="safety-heading">Staying safe outdoors</h2>
          <p>
            Routes on ATTrails are shared by other people. We don&apos;t check
            that they&apos;re accurate, legal to use, or safe. Conditions
            change, and a route that suited someone else may not suit you.
          </p>
          <p>
            Before you set off, check the route yourself, respect access rights
            and local rules, and make sure you have the skills, fitness and
            equipment it needs. You&apos;re responsible for your own safety.
          </p>
        </section>

        <section aria-labelledby="service-heading">
          <h2 id="service-heading">The service</h2>
          <p>
            ATTrails is provided free of charge, &ldquo;as is&rdquo; and
            &ldquo;as available&rdquo;. We may change, pause or stop any part of
            it at any time. Because your content lives on your own account, it
            stays with you even if ATTrails goes away.
          </p>
        </section>

        <section aria-labelledby="liability-heading">
          <h2 id="liability-heading">Liability</h2>
          <p>
            To the extent the law allows, we&apos;re not liable for any loss or
            damage arising from your use of ATTrails or from content shared by
            other people, including any route you choose to follow.
          </p>
          <p>
            Nothing in these terms limits liability for death or personal injury
            caused by our negligence, for fraud, or for anything else that
            can&apos;t be limited by law, and nothing affects your statutory
            rights as a consumer.
          </p>
        </section>

        <section aria-labelledby="ending-heading">
          <h2 id="ending-heading">Ending your use</h2>
          <p>
            You can stop using ATTrails at any time by signing out. You can also
            revoke ATTrails&apos; access to your account from your PDS provider,
            and delete your routes and reviews from your account.
          </p>
        </section>

        <section aria-labelledby="changes-heading">
          <h2 id="changes-heading">Changes to these terms</h2>
          <p>
            We may update these terms. We&apos;ll change the date at the top of
            this page and announce significant changes on Bluesky. If you keep
            using ATTrails after a change, you accept the updated terms.
          </p>
        </section>

        <section aria-labelledby="law-heading">
          <h2 id="law-heading">Governing law</h2>
          <p>
            These terms are governed by the laws of England and Wales, and the
            courts of England and Wales have jurisdiction. If you live elsewhere
            in the UK or in another country, you keep any protections your local
            law gives you, and may bring proceedings where you live.
          </p>
        </section>

        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading">Contact us</h2>
          <p>
            Questions about these terms? Message{" "}
            <a href="https://bsky.app/profile/attrails.app">@attrails.app</a> on
            Bluesky.
          </p>
        </section>
      </article>
    </main>
  );
}
