import { Suspense } from "react";
import { RecentRoutes, RecentRoutesSkeleton } from "@/components/recent-routes";

export default function Home() {
  return (
    <main className="flex flex-col gap-12 px-4 py-8 sm:p-16">
      <h1 className="font-serif text-4xl sm:text-6xl">
        Where will the <span className="text-primary">morning</span> take you?
      </h1>
      <section
        aria-labelledby="recent-routes-heading"
        className="flex flex-col gap-6"
      >
        <h2 id="recent-routes-heading" className="font-serif text-3xl">
          Recently added
        </h2>
        <Suspense fallback={<RecentRoutesSkeleton />}>
          <RecentRoutes />
        </Suspense>
      </section>
    </main>
  );
}
