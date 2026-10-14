use anyhow::{Context, Result};
use atproto_tap::RecordEvent;
use database::users::NewUser;
use jiff::Timestamp;
use lexicons::app_attrails::actor::profile::Profile;

/// Build a `users` row from a create or update event and its parsed
/// profile record.
///
/// # Errors
///
/// Will return an `Err` if the event has no cid, the record's `createdAt`
/// is not a valid timestamp, or its profile picture can not be serialised
/// to JSON.
pub fn from_event(event: &RecordEvent, profile: &Profile) -> Result<NewUser> {
    let cid = event.cid.as_deref().context("profile event has no cid")?;
    let created_at: Timestamp = profile
        .created_at
        .as_str()
        .parse()
        .context("profile has an invalid createdAt")?;
    let ingested_at = Timestamp::now();

    let profile_picture_uri = profile
        .profile_picture
        .as_ref()
        .map(serde_json::to_value)
        .transpose()?;

    Ok(NewUser {
        uri: event.at_uri(),
        did: event.did.to_string(),
        cid: cid.to_string(),
        name: profile.name.to_string(),
        bio: profile.bio.as_ref().map(ToString::to_string),
        profile_picture_uri,
        // Records can claim any createdAt, so never sort them into the future.
        sort_at: created_at.min(ingested_at),
        created_at,
        ingested_at,
    })
}
