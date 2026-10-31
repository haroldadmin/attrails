import "server-only";

import { type Agent, Client, currentDatetimeString } from "@atproto/lex";
import { AtUri } from "@atproto/syntax";
import { app } from "@/lexicons";
import { logger } from "@/lib/logger";
import { loadViewerReview } from "./queries";
import type { ReviewDraft, Subject } from "./shared";

const { review } = app.attrails;

export type SaveReviewError = "self-review" | "invalid" | "write-failed";

export type SaveReviewResult =
  | { ok: true; outcome: "created" | "updated" }
  | { ok: false; reason: SaveReviewError };

/**
 * Saves `draft` to the account's repository as its review of `subject`,
 * replacing its newest review of `subject` if it has one.
 */
export async function saveReview(
  agent: Agent,
  subject: Subject,
  draft: ReviewDraft,
): Promise<SaveReviewResult> {
  const client = new Client(agent);
  const did = client.assertDid;
  if (new AtUri(subject.uri).hostname === did) {
    return { ok: false, reason: "self-review" };
  }

  const record = review.$safeValidate({
    $type: review.$type,
    subject: { uri: subject.uri, cid: subject.cid },
    rating: draft.rating,
    text: draft.text,
    createdAt: currentDatetimeString(),
  });
  if (!record.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const latest = await loadViewerReview(
      subject,
      { did },
      { labelled: "include" },
    );
    if (latest) {
      const { rkey } = new AtUri(latest.uri);
      await client.put(review, record.value, { rkey });
      return { ok: true, outcome: "updated" };
    }

    await client.create(review, record.value);
    return { ok: true, outcome: "created" };
  } catch (error) {
    logger.warn({ err: error, did, subject: subject.uri }, "reviews:save");
    return { ok: false, reason: "write-failed" };
  }
}

export type DeleteReviewError = "not-found" | "write-failed";

export type DeleteReviewResult =
  { ok: true } | { ok: false; reason: DeleteReviewError };

/**
 * Deletes the account's newest review of `subject`. Older reviews of it stay
 * in the repository.
 */
export async function deleteReview(
  agent: Agent,
  subject: Pick<Subject, "uri">,
): Promise<DeleteReviewResult> {
  const client = new Client(agent);
  const did = client.assertDid;

  try {
    const latest = await loadViewerReview(
      subject,
      { did },
      { labelled: "include" },
    );
    if (!latest) {
      return { ok: false, reason: "not-found" };
    }

    const { rkey } = new AtUri(latest.uri);
    await client.delete(review, { rkey });
    return { ok: true };
  } catch (error) {
    logger.warn({ err: error, did, subject: subject.uri }, "reviews:delete");
    return { ok: false, reason: "write-failed" };
  }
}
