import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { fetchUserReview } from "@/lib/reviews";
import { fetchRoute } from "@/lib/routes";
import { deleteReview, saveReview } from "./actions";
import { DeleteReview } from "./delete-review";
import { ReviewForm } from "./review-form";

type ReviewPageProps = PageProps<"/routes/[did]/[rkey]/review">;

export const metadata: Metadata = {
  title: "Review a route · ATTrails",
};

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

  const session = await getSession();
  if (!session) {
    redirect(loginHref(`${routePath}/review`));
  }

  const route = await fetchRoute(did, rkey);
  if (!route) {
    notFound();
  }

  if (route.did === session.did) {
    redirect(routePath);
  }

  const review = await fetchUserReview(route.uri, session.did);

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
      <ReviewForm
        action={saveReview.bind(null, route.did, route.rkey)}
        initialValues={{
          rating: review ? String(review.rating) : "",
          text: review?.text ?? "",
        }}
        isUpdate={review !== null}
      />
      {review && (
        <DeleteReview
          action={deleteReview.bind(null, route.did, route.rkey, review.rkey)}
        />
      )}
    </>
  );
}
