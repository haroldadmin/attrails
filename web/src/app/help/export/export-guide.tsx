import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export function exportGuideMetadata(name: string): Metadata {
  return {
    title: `Export a route from ${name}`,
    description: `How to export a route from ${name} as a GPX file and share it on ATTrails.`,
  };
}

export type ExportGuideProps = {
  name: string;
  // The app's own help article, for when its steps change.
  helpUrl: string;
  // The intro and steps, as `prose` content.
  children: ReactNode;
};

/**
 * A guide to exporting a GPX file from another app. The steps are the app's
 * own; sharing advice and the way back to the upload form are common to all.
 */
export function ExportGuide({ name, helpUrl, children }: ExportGuideProps) {
  return (
    <main className="px-4 py-8 sm:p-16">
      <article className="prose prose-attrails">
        <p>
          <Link href="/help">Help</Link>
        </p>
        <h1>Export a route from {name}</h1>

        {children}

        <p>
          {name} sometimes changes where these options are. If something looks
          different, check <a href={helpUrl}>{name}&apos;s own help article</a>.
        </p>

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
        </section>

        <section aria-labelledby="share-heading">
          <h2 id="share-heading">Share it on ATTrails</h2>
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
      </article>
    </main>
  );
}
