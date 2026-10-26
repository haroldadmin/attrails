use amqp::BlobMsg;
use anyhow::{Context, Result};
use atproto_tap::RecordEvent;
use database::routes::NewRoute;
use jiff::Timestamp;
use lexicons::app_attrails::route::Route;
use serde_json::json;

/// Build a `routes` row from a create or update event and its parsed record.
///
/// # Errors
///
/// Will return an `Err` if the event has no cid, the record's `createdAt`
/// is not a valid timestamp, or its images or details can not be
/// serialised to JSON.
pub fn from_event(event: &RecordEvent, route: &Route) -> Result<NewRoute> {
    let cid = event.cid.as_deref().context("route event has no cid")?;
    let created_at: Timestamp = route
        .created_at
        .as_str()
        .parse()
        .context("route has an invalid createdAt")?;
    let ingested_at = Timestamp::now();

    let images = match &route.images {
        Some(images) => serde_json::to_value(images)?,
        None => json!([]),
    };
    let details = match &route.details {
        Some(details) => serde_json::to_value(details)?,
        None => json!({}),
    };

    Ok(NewRoute {
        uri: event.at_uri(),
        cid: cid.to_string(),
        did: event.did.to_string(),
        rkey: event.rkey.to_string(),
        name: route.name.to_string(),
        description: route.description.as_ref().map(ToString::to_string),
        activity: route.activity.as_str().to_string(),
        surface: route.surface.as_ref().map(|s| s.as_str().to_string()),
        difficulty: route.difficulty.as_ref().map(|d| d.as_str().to_string()),
        tags: route
            .tags
            .iter()
            .flatten()
            .map(ToString::to_string)
            .collect(),
        images,
        details,
        // Records can claim any createdAt, so never sort them into the future.
        sort_at: created_at.min(ingested_at),
        created_at,
        ingested_at,
        gpx_cid: route.track.blob().cid().as_str().to_string(),
    })
}

/// Build a message asking for the route's GPX blob to be parsed.
pub fn blob_msg(event: &RecordEvent, route: &Route) -> BlobMsg {
    let blob = route.track.blob();
    BlobMsg {
        did: event.did.to_string(),
        cid: blob.cid().as_str().to_string(),
        mime_type: blob.mime_type.as_str().to_string(),
        size: blob.size,
    }
}
