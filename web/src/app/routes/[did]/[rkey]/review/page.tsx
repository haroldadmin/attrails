import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { assertSession } from "@/auth/session";
import { ReviewModerationNotice } from "@/components/moderation-notice";
import { loadLabelledUris } from "@/lib/moderation";
import { loadViewerReview } from "@/lib/reviews";
import { fetchRoute } from "@/lib/routes";
import { deleteRouteReview, saveRouteReview } from "./actions";
import { DeleteReview } from "./delete-review";
import { ReviewForm } from "./review-form";

type ReviewPageProps = PageProps<"/routes/[did]/[rkey]/review">;

export async function generateMetadata({
  params,
}: ReviewPageProps): Promise<Metadata> {
  const { did, rkey } = await params;
  const route = await fetchRoute(decodeURIComponent(did), rkey);
  return { title: route ? `Review ${route.name}` : "Review a route" };
}

export default function ReviewPage({ params }: ReviewPageProps) {
  return (
    <main className="flex flex-col gap-6 w-full max-w-2xl mx-auto px-4 py-8 sm:py-16">
      <Suspense>
        <ManageReview params={params} />
      </Suspense>
    </main>
  );
}

async function ManageReview({ params }: Pick<ReviewPageProps, "params">) {
  const { did: encodedDid, rkey } = await params;
  const did = decodeURIComponent(encodedDid);
  const routePath = `/routes/${did}/${rkey}`;

  const session = await assertSession(`${routePath}/review`);

  const route = await fetchRoute(did, rkey);
  if (!route) {
    notFound();
  }

  if (route.did === session.did) {
    redirect(routePath);
  }

  const review = await loadViewerReview(
    route,
    { did: session.did },
    { labelled: "include" },
  );
  const labelled = review
    ? (await loadLabelledUris([review])).has(review.uri)
    : false;

  return (
    <>
      <h1 className="font-serif text-4xl">
        {review ? "Edit your review" : "Write a review"}
      </h1>
      <p>
        {review ? "Your review" : "Reviewing"}{" "}
        <Link href={routePath} className="link">
          {route.name}
        </Link>
        .
      </p>
      {labelled && <ReviewModerationNotice />}
      <ReviewForm
        action={saveRouteReview.bind(null, route.did, route.rkey)}
        initialValues={{
          rating: review ? String(review.rating) : "",
          text: review?.text ?? "",
        }}
        isUpdate={review !== null}
      />
      {review && (
        <DeleteReview
          action={deleteRouteReview.bind(null, route.did, route.rkey)}
        />
      )}
    </>
  );
}
