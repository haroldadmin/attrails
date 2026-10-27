import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What information ATTrails collects, why, who it's shared with, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-col gap-10 px-4 py-8 sm:p-16 max-w-4xl">
      <hgroup className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl">Privacy Policy</h1>
        <p>
          Last updated <time dateTime="2026-10-27">27 October 2026</time>
        </p>
      </hgroup>

      <section aria-labelledby="who-heading" className="flex flex-col gap-4">
        <h2 id="who-heading" className="font-serif text-2xl">
          Who we are
        </h2>
        <p>
          ATTrails is run by{" "}
          <a href="https://bsky.app/profile/haroldadmin.com" className="link">
            @haroldadmin.com
          </a>
          , an individual based in the United Kingdom. In this policy,
          &ldquo;ATTrails&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean the
          operator of attrails.app. For the purposes of UK data protection law,
          we are the controller of the personal data described here.
        </p>
      </section>

      <section
        aria-labelledby="protocol-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="protocol-heading" className="font-serif text-2xl">
          How ATTrails is different
        </h2>
        <p>
          ATTrails is built on the{" "}
          <a className="link link-primary" href="https://atproto.com">
            AT Protocol
          </a>
          . You sign in with an existing AT Protocol account, such as a Bluesky
          account, and the routes and reviews you create are saved to that
          account&apos;s Personal Data Server (PDS), not to ATTrails.
        </p>
        <p>
          Records on the AT Protocol are public. Anyone, including other apps,
          can read them. ATTrails reads public records from the network and
          keeps its own copy (an index) so it can show, search and map them.
          Your PDS provider has its own privacy policy, which covers the data it
          holds for you.
        </p>
      </section>

      <section
        aria-labelledby="collect-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="collect-heading" className="font-serif text-2xl">
          What we collect
        </h2>
        <h3 className="font-semibold">Public records from the network</h3>
        <p>
          We index ATTrails routes (including GPX files, names, descriptions,
          tags and the paths they describe), reviews, and basic profile
          information (your DID, handle, display name and avatar). This applies
          to anyone who publishes these records, whether or not they have signed
          in to ATTrails.
        </p>
        <h3 className="font-semibold">When you sign in</h3>
        <p>
          We store the OAuth session issued by your PDS, which includes your DID
          and access tokens that let ATTrails create, edit and delete ATTrails
          routes and reviews on your behalf. We can&apos;t see your password. We
          also set one cookie, described below.
        </p>
        <h3 className="font-semibold">When you visit</h3>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>
            <strong>Approximate location.</strong> Our network provider,
            Cloudflare, estimates your location from your IP address. We round
            it to about 1&nbsp;km and use it only to show routes near you. We
            don&apos;t store it.
          </li>
          <li>
            <strong>Analytics.</strong> We use a self-hosted instance of{" "}
            <a className="link link-primary" href="https://umami.is">
              Umami
            </a>{" "}
            to count page views. It doesn&apos;t use cookies or build profiles
            of individual visitors, and it doesn&apos;t run if your browser
            sends a Do Not Track signal.
          </li>
          <li>
            <strong>Logs.</strong> Our servers record technical logs and traces
            (such as requests, errors and, when you&apos;re signed in, your DID)
            to keep ATTrails secure and working.
          </li>
        </ul>
      </section>

      <section aria-labelledby="use-heading" className="flex flex-col gap-4">
        <h2 id="use-heading" className="font-serif text-2xl">
          How we use it, and our legal basis
        </h2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>
            <strong>Providing ATTrails</strong>, including signing you in and
            saving routes and reviews to your account: necessary to provide the
            service you asked for (contract).
          </li>
          <li>
            <strong>Indexing, searching and displaying public records</strong>:
            our legitimate interest in running a route discovery service over
            public AT Protocol data.
          </li>
          <li>
            <strong>Moderation</strong>, so ATTrails stays useful and welcoming:
            our legitimate interest. See our{" "}
            <Link className="link link-primary" href="/moderation">
              moderation approach
            </Link>
            .
          </li>
          <li>
            <strong>Security, debugging and usage analytics</strong>: our
            legitimate interest in keeping ATTrails secure and improving it.
          </li>
        </ul>
        <p>We don&apos;t sell your data or use it for advertising.</p>
      </section>

      <section aria-labelledby="share-heading" className="flex flex-col gap-4">
        <h2 id="share-heading" className="font-serif text-2xl">
          Who we share it with
        </h2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>
            <strong>Cloudflare</strong> carries all traffic to ATTrails and sees
            your IP address and requests.
          </li>
          <li>
            <strong>Typesafe</strong> receives the text of routes, reviews and
            profiles so its Jev model can suggest moderation labels.
          </li>
          <li>
            <strong>OpenFreeMap</strong> serves map tiles directly to your
            browser, so it sees your IP address and which map areas you view.
          </li>
          <li>
            <strong>Your PDS</strong> receives the records ATTrails writes on
            your behalf.
          </li>
        </ul>
        <p>
          Some of these providers may process data outside the UK. Where they
          do, we rely on safeguards recognised under UK law, such as adequacy
          regulations or the UK International Data Transfer Addendum. We may
          also disclose information if the law requires it.
        </p>
      </section>

      <section
        aria-labelledby="cookies-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="cookies-heading" className="font-serif text-2xl">
          Cookies
        </h2>
        <p>
          We set a single, strictly necessary cookie,{" "}
          <code>attrails_session</code>, when you sign in. It keeps you signed
          in for up to 30 days, and is removed when you sign out. We don&apos;t
          use advertising or tracking cookies.
        </p>
      </section>

      <section
        aria-labelledby="retention-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="retention-heading" className="font-serif text-2xl">
          How long we keep it
        </h2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>
            Sign-in sessions expire after 30 days. Your OAuth session is deleted
            when you sign out of every browser, or when your account is deleted,
            deactivated or taken down.
          </li>
          <li>
            When you delete a route, review or profile from your account, or
            delete your account, we mark our indexed copy as deleted and stop
            showing it. Ask us and we&apos;ll erase it from our index entirely.
          </li>
          <li>
            Logs and traces are kept for a limited time and deleted on a rolling
            basis.
          </li>
        </ul>
      </section>

      <section aria-labelledby="rights-heading" className="flex flex-col gap-4">
        <h2 id="rights-heading" className="font-serif text-2xl">
          Your rights
        </h2>
        <p>
          Under UK data protection law you can ask to access, correct or erase
          your personal data, to restrict or object to how we use it, and to
          receive it in a portable format. You can edit or delete your routes
          and reviews yourself at any time, and those changes reach ATTrails
          automatically.
        </p>
        <p>
          If you&apos;re unhappy with how we handle your data, you can complain
          to the{" "}
          <a className="link link-primary" href="https://ico.org.uk">
            Information Commissioner&apos;s Office
          </a>
          , though we&apos;d appreciate the chance to sort it out first.
        </p>
      </section>

      <section
        aria-labelledby="children-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="children-heading" className="font-serif text-2xl">
          Children
        </h2>
        <p>
          ATTrails isn&apos;t meant for anyone under 13. If you think a child
          under 13 has signed in, let us know and we&apos;ll remove their data.
        </p>
      </section>

      <section
        aria-labelledby="changes-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="changes-heading" className="font-serif text-2xl">
          Changes
        </h2>
        <p>
          We&apos;ll update the date at the top of this page when this policy
          changes, and announce significant changes on Bluesky.
        </p>
      </section>

      <section
        aria-labelledby="contact-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="contact-heading" className="font-serif text-2xl">
          Contact us
        </h2>
        <p>
          For privacy questions or requests, message{" "}
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
