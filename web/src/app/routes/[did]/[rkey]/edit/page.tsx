import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { fetchRoute } from "@/lib/routes";
import { ACTIVITIES, DIFFICULTIES, SURFACES } from "@/lib/labels";
import { deleteRoute, saveRoute } from "./actions";
import { DeleteRoute } from "./delete-route";
import { EditRouteForm } from "./edit-route-form";

type EditRoutePageProps = PageProps<"/routes/[did]/[rkey]/edit">;

export const metadata: Metadata = {
  title: "Edit route · ATTrails",
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

  const session = await getSession();
  if (!session) {
    redirect(loginHref(`${routePath}/edit`));
  }

  const route = await fetchRoute(did, rkey);
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
        action={saveRoute.bind(null, route.did, route.rkey, route.cid)}
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
      <DeleteRoute action={deleteRoute.bind(null, route.did, route.rkey)} />
    </>
  );
}
