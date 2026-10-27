import { serializeJsonLd, type JsonLdNode } from "@/lib/structured-data";

/** Renders server-side structured data. This is not executable JavaScript. */
export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
