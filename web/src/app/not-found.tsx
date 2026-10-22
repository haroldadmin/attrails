import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-col gap-6 px-4 py-8 sm:p-16">
      <h1 className="font-serif text-4xl">Off the map</h1>
      <p>We couldn&apos;t find the page you were looking for.</p>
      <p>
        <Link className="link link-primary" href="/">
          Back to Discover
        </Link>
      </p>
    </main>
  );
}
