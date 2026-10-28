import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { assertSession } from "@/auth/session";
import { ACTIVITIES, DIFFICULTIES, loadRoute, SURFACES } from "@/lib/routes";
import { deleteRouteAction, saveRouteAction } from "./actions";
import { DeleteRoute } from "./delete-route";
import { EditRouteForm } from "./edit-route-form";

type EditRoutePageProps = PageProps<"/routes/[did]/[rkey]/edit">;

export const metadata: Metadata = {
  title: "Edit route",
};

export default function EditRoutePage({ params }: EditRoutePageProps) {
  return (
    <main className="flex flex-col gap-6 w-full max-w-2xl mx-auto px-4 py-8 sm:py-16">
      <h1 className="font-serif text-4xl">Edit route</h1>
      <Suspense>
        <EditRoute params={params} />
      </Suspense>
    </main>
  );
}

async function EditRoute({ params }: Pick<EditRoutePageProps, "params">) {
  const { did: encodedDid, rkey } = await params;
  const did = decodeURIComponent(encodedDid);
  const routePath = `/routes/${did}/${rkey}`;

  const session = await assertSession(`${routePath}/edit`);

  const route = await loadRoute({ did, rkey }, { labelled: "include" });
  if (!route) {
    notFound();
  }

  if (route.did !== session.did) {
    redirect(routePath);
  }

  return (
    <>
      <p>
        Editing{" "}
        <Link href={routePath} className="link">
          {route.name}
        </Link>
        .
      </p>
      <EditRouteForm
        action={saveRouteAction.bind(null, route.did, route.rkey, route.cid)}
        initialValues={{
          name: route.name,
          description: route.description ?? "",
          activity: route.activity,
          surface: route.surface ?? "",
          difficulty: route.difficulty ?? "",
          tags: route.tags.join(", "),
        }}
        activities={ACTIVITIES}
        surfaces={SURFACES}
        difficulties={DIFFICULTIES}
      />
      <DeleteRoute
        action={deleteRouteAction.bind(null, route.did, route.rkey)}
      />
    </>
  );
}
