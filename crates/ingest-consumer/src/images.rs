use anyhow::{Context, Result};
use jacquard::{client::BasicClient, types::blob::BlobRef};
use lexicons::app_attrails::Image;
use serde_json::Value;

use crate::blobs;

/// Download the images of a route or review, from the JSON stored in its
/// `images` column, so they can be moderated.
///
/// # Errors
///
/// Returns an error if the JSON is not a list of images, or any image can not
/// be fetched.
pub async fn fetch_images(
    agent: &BasicClient,
    did: &str,
    images: Value,
) -> Result<Vec<moderation::Image>> {
    let images: Vec<Image> =
        serde_json::from_value(images).context("stored images are not valid")?;

    let mut fetched = Vec::with_capacity(images.len());
    for image in images {
        let cid = image.image.blob().cid().as_str();
        let bytes = blobs::fetch_blob(agent, did, cid)
            .await
            .context("failed to fetch image blob")?;
        fetched.push(moderation::Image::new(cid, bytes, image.alt));
    }

    Ok(fetched)
}

/// Download a profile picture, from the JSON stored in the `users` table, so
/// it can be moderated. Profile pictures have no alt text.
///
/// # Errors
///
/// Returns an error if the JSON is not a blob reference, or the blob can not
/// be fetched.
pub async fn fetch_profile_picture(
    agent: &BasicClient,
    did: &str,
    picture: Option<Value>,
) -> Result<Option<moderation::Image>> {
    let Some(picture) = picture else {
        return Ok(None);
    };

    let picture: BlobRef =
        serde_json::from_value(picture).context("stored profile picture is not valid")?;
    let cid = picture.blob().cid().as_str();
    let bytes = blobs::fetch_blob(agent, did, cid)
        .await
        .context("failed to fetch profile picture blob")?;

    Ok(Some(moderation::Image::new(cid, bytes, "")))
}

#[cfg(test)]
mod tests {
    use jacquard::types::blob::BlobRef;
    use lexicons::app_attrails::Image;

    // CID for "foo"
    const CID: &str = "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy";

    #[test]
    fn stored_images_should_deserialize() {
        let json = serde_json::json!([{
            "alt": "A summit cairn",
            "image": {
                "$type": "blob",
                "ref": { "$link": CID },
                "mimeType": "image/webp",
                "size": 1000
            }
        }]);

        let images: Vec<Image> = serde_json::from_value(json).expect("expected valid images");
        assert_eq!(images[0].alt.as_str(), "A summit cairn");
        assert_eq!(images[0].image.blob().cid().as_str(), CID);
    }

    #[test]
    fn stored_images_should_round_trip() {
        let json = serde_json::json!({
            "$type": "blob",
            "ref": { "$link": CID },
            "mimeType": "image/webp",
            "size": 1000
        });

        let blob: BlobRef = serde_json::from_value(json).expect("expected valid blob");
        let stored = serde_json::to_value(&blob).expect("expected blob to serialize");
        let blob: BlobRef =
            serde_json::from_value(stored).expect("expected stored blob to deserialize");
        assert_eq!(blob.blob().cid().as_str(), CID);
    }
}
