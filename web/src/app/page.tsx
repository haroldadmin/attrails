import { Suspense } from "react";
import { RecentRoutes, RecentRoutesSkeleton } from "@/components/recent-routes";
import { Notice } from "@/components/notice";

export default function Home() {
  return (
    <main className="flex flex-col gap-12 px-4 py-8 sm:p-16">
      <hgroup className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl sm:text-6xl">
          Where will the <span className="text-primary">trail</span> take you?
        </h1>
        <p className="text-lg text-base-content/70">
          Discover and share cycling, running, and hiking routes on the open
          social web.
        </p>
      </hgroup>
      <section
        aria-labelledby="recent-routes-heading"
        className="flex flex-col gap-6"
      >
        <h2 id="recent-routes-heading" className="font-serif text-3xl">
          Recently added
        </h2>
        <Suspense>
          <Notice
            messages={{
              "route-uploaded":
                "Route uploaded. It'll appear here once it has been processed.",
            }}
          />
        </Suspense>
        <Suspense fallback={<RecentRoutesSkeleton />}>
          <RecentRoutes />
        </Suspense>
      </section>
    </main>
  );
}
