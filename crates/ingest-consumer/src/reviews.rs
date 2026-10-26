use anyhow::{Context, Result};
use atproto_tap::RecordEvent;
use database::reviews::NewReview;
use jiff::Timestamp;
use lexicons::app_attrails::review::Review;
use serde_json::json;

/// Build a `reviews` row from a create or update event and its parsed record.
///
/// # Errors
///
/// Will return an `Err` if the event has no cid, the record's `createdAt`
/// is not a valid timestamp, its rating does not fit in an `i32`, or its
/// images can not be serialised to JSON.
pub fn from_event(event: &RecordEvent, review: &Review) -> Result<NewReview> {
    let cid = event.cid.as_deref().context("review event has no cid")?;
    let created_at: Timestamp = review
        .created_at
        .as_str()
        .parse()
        .context("review has an invalid createdAt")?;
    let ingested_at = Timestamp::now();

    let rating = i32::try_from(review.rating).context("review rating is out of range")?;
    let images = match &review.images {
        Some(images) => serde_json::to_value(images)?,
        None => json!([]),
    };

    Ok(NewReview {
        uri: event.at_uri(),
        cid: cid.to_string(),
        did: event.did.to_string(),
        rkey: event.rkey.to_string(),
        subject_uri: review.subject.uri.as_str().to_string(),
        subject_cid: review.subject.cid.as_str().to_string(),
        rating,
        body: review.text.as_ref().map(ToString::to_string),
        images,
        // Records can claim any createdAt, so never sort them into the future.
        sort_at: created_at.min(ingested_at),
        created_at,
        ingested_at,
    })
}
