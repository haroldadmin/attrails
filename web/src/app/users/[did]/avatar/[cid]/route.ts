import { type AvatarError, fetchAvatar } from "@/lib/profiles";

const ERRORS: Record<AvatarError, { status: number; message: string }> = {
  "not-found": { status: 404, message: "Profile picture not found." },
  unsupported: { status: 415, message: "Unsupported profile picture." },
  "fetch-failed": {
    status: 502,
    message: "We couldn't fetch the profile picture.",
  },
};

export async function GET(
  _request: Request,
  { params }: RouteContext<"/users/[did]/avatar/[cid]">,
) {
  const { did, cid } = await params;

  const avatar = await fetchAvatar(decodeURIComponent(did), cid);
  if (!avatar.ok) {
    const { status, message } = ERRORS[avatar.reason];
    return new Response(message, { status });
  }

  const headers = new Headers({
    "Content-Type": avatar.mimeType,
    "Cache-Control": "public, max-age=3600, immutable",
    "X-Content-Type-Options": "nosniff",
  });

  const length = avatar.blob.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(avatar.blob.body, { headers });
}
