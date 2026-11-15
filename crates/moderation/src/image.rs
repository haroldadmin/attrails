use anyhow::{Result, bail};
use bytes::Bytes;
use std::io::Cursor;

use image::{
    DynamicImage, ImageDecoder, ImageReader, codecs::jpeg::JpegEncoder, imageops::FilterType,
};

const MAX_SIDE: u32 = 1568;
const MIN_SIDE: u32 = 280;

#[derive(PartialEq)]
pub struct Image {
    pub cid: String,
    pub bytes: Bytes,
    pub alt: String,
}

impl Image {
    pub fn new(cid: impl Into<String>, bytes: impl Into<Bytes>, alt: impl Into<String>) -> Self {
        Self {
            cid: cid.into(),
            bytes: bytes.into(),
            alt: alt.into(),
        }
    }

    pub fn img_ref(&self) -> String {
        format!("img-{}", self.cid)
    }

    pub fn to_state(&self) -> serde_json::Value {
        serde_json::json!({
            "image": self.img_ref(),
            "alt": self.alt,
        })
    }
}

pub(crate) fn prepare(bytes: &[u8]) -> Result<Vec<u8>> {
    let image = decode_upright(bytes)?;
    let image = fit_image(image)?;
    encode_jpeg(&image)
}

/// Decodes the image data into a dynamic image
/// with the correct orientation
fn decode_upright(bytes: &[u8]) -> Result<DynamicImage> {
    let mut decoder = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()?
        .into_decoder()?;
    let orientation = decoder.orientation()?;

    let mut image = DynamicImage::from_decoder(decoder)?;
    image.apply_orientation(orientation);

    Ok(image)
}

/// Tries to fit the image within min/max bounds.
fn fit_image(image: DynamicImage) -> Result<DynamicImage> {
    let mut image = image;
    if image.width() > MAX_SIDE || image.height() > MAX_SIDE {
        image = image.resize(MAX_SIDE, MAX_SIDE, FilterType::Lanczos3);
    }

    let shortest = image.width().min(image.height());
    if shortest < MIN_SIDE {
        let nwidth = image.width() * MIN_SIDE / shortest;
        let nheight = image.height() * MIN_SIDE / shortest;
        if nwidth > MAX_SIDE || nheight > MAX_SIDE {
            bail!(
                "image is too narrow to fit limits ({MIN_SIDE}): {}×{}",
                image.width(),
                image.height()
            );
        }

        image = image.resize_exact(nwidth, nheight, FilterType::Lanczos3);
    }

    Ok(image)
}

fn encode_jpeg(image: &DynamicImage) -> Result<Vec<u8>> {
    let mut buf = Vec::new();
    let encoder = JpegEncoder::new_with_quality(&mut buf, 90);

    let rgb = image.to_rgb8();
    rgb.write_with_encoder(encoder)?;

    Ok(buf)
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use image::{DynamicImage, ImageFormat, RgbImage, load_from_memory};

    use crate::image::{MAX_SIDE, MIN_SIDE};

    use super::prepare;

    fn png(width: u32, height: u32) -> Vec<u8> {
        let image = DynamicImage::ImageRgb8(RgbImage::new(width, height));
        let mut buf = Vec::new();
        let cursor = Cursor::new(&mut buf);
        image
            .write_to(cursor, ImageFormat::Png)
            .expect("failed to encode test image");
        buf
    }

    #[test]
    fn prepare_should_resize_large_image_to_fit_within_bounds() {
        let bytes = prepare(&png(3000, 2000)).expect("expected prepare to succeed");
        let output = load_from_memory(&bytes).expect("expected output to be a valid image");
        assert_eq!(output.width(), MAX_SIDE);
        assert!(output.height() <= MAX_SIDE);
    }

    #[test]
    fn prepare_should_upscale_small_image_to_fit_within_bounds() {
        let bytes = prepare(&png(100, 100)).expect("expected prepare to succeed");
        let output = load_from_memory(&bytes).expect("expected output to be a valid image");
        assert_eq!(output.width(), MIN_SIDE);
        assert_eq!(output.height(), MIN_SIDE);
    }

    #[test]
    fn prepare_should_keep_size_of_image_within_bounds() {
        let bytes = prepare(&png(800, 600)).expect("expected prepare to succeed");
        let output = load_from_memory(&bytes).expect("expected output to be a valid image");
        assert_eq!((output.width(), output.height()), (800, 600));
    }

    #[test]
    fn prepare_should_return_error_for_too_narrow_images() {
        assert!(prepare(&png(2000, 100)).is_err_and(|e| { e.to_string().contains("too narrow") }));
    }
}
