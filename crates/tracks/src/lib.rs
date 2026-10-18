use anyhow::Result;
use geo::{Distance, HaversineMeasure, Length, LineString, MultiLineString, Point, Simplify};
use serde::Serialize;

/// Version of the parsing logic in this crate. Bump it whenever the output
/// for the same GPX file changes, so stored tracks are parsed again.
pub const PARSER_VERSION: i32 = 2;

const ELEVATION_CHANGE_THRESHOLD_METERS: f64 = 4.0;
const ELEVATION_PROFILE_SAMPLES: usize = 200;

// In degrees, roughly 5 meters. Points closer than this to the simplified
// line are dropped.
const PATH_SIMPLIFICATION_TOLERANCE_DEGREES: f64 = 0.00005;

// Tracks whose start and end points are closer than this are loops.
const LOOP_THRESHOLD_METERS: f64 = 200.0;

const MAX_WAYPOINT_NAME_LENGTH: usize = 100;
const MAX_WAYPOINT_DESC_LENGTH: usize = 500;

/// Haversine distances on a sphere with the commonly used 6371 km radius.
const HAVERSINE: HaversineMeasure = HaversineMeasure::new(6_371_000.0);

/// Structured data extracted from a GPX file.
#[derive(Debug, Clone)]
pub struct TrackData {
    /// Number of points across all segments of the track.
    pub point_count: usize,
    pub start_point: Point,
    pub end_point: Point,
    /// Whether the start and end points are close together.
    pub is_loop: bool,
    /// Total distance along each segment. Gaps between segments are not
    /// included.
    pub distance_m: f64,
    /// Unavailable if the track has no elevation data.
    pub elevation: Option<Elevation>,
    /// Simplified path, with one line per segment.
    pub path: MultiLineString,
    /// `(cumulative distance, elevation)` pairs, at most
    /// `ELEVATION_PROFILE_SAMPLES` long. Empty if the track has no elevation
    /// data.
    pub elevation_profile: Vec<(f64, f64)>,
    pub waypoints: Vec<Waypoint>,
}

impl TrackData {
    /// Extracts structured track data from the contents of a GPX file.
    ///
    /// Tracks (`<trk>`) and routes (`<rte>`) both become segments, tracks
    /// first. Segments with fewer than two points are skipped.
    ///
    /// # Errors
    ///
    /// Will return an `Err` if the file is not valid GPX, or has no segments
    /// with at least two points.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        let parsed = gpx::read(bytes)?;
        let segments: Vec<&[gpx::Waypoint]> = parsed
            .tracks
            .iter()
            .flat_map(|track| &track.segments)
            .map(|segment| segment.points.as_slice())
            .chain(parsed.routes.iter().map(|route| route.points.as_slice()))
            .filter(|points| points.len() >= 2)
            .collect();

        let (Some(first), Some(last)) = (segments.first(), segments.last()) else {
            return Err(anyhow::Error::msg("GPX file contains no track data"));
        };

        let start_point = first[0].point();
        let end_point = last[last.len() - 1].point();

        let lines: Vec<LineString> = segments
            .iter()
            .map(|points| points.iter().map(gpx::Waypoint::point).collect())
            .collect();

        Ok(TrackData {
            point_count: segments.iter().map(|points| points.len()).sum(),
            start_point,
            end_point,
            is_loop: HAVERSINE.distance(start_point, end_point) < LOOP_THRESHOLD_METERS,
            distance_m: lines.iter().map(|line| HAVERSINE.length(line)).sum(),
            elevation: elevation(
                segments
                    .iter()
                    .copied()
                    .flatten()
                    .filter_map(|p| p.elevation),
            ),
            path: lines
                .iter()
                .map(|line| line.simplify(PATH_SIMPLIFICATION_TOLERANCE_DEGREES))
                .collect(),
            elevation_profile: elevation_profile(&segments),
            waypoints: parsed.waypoints.iter().map(waypoint).collect(),
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Elevation {
    pub min_m: f64,
    pub max_m: f64,
    /// Approximate elevation gained, ignoring changes below a noise
    /// threshold.
    pub gain_m: f64,
    /// Approximate elevation lost, ignoring changes below a noise threshold.
    pub loss_m: f64,
}

/// A point of interest (`<wpt>`) in a GPX file.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Waypoint {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub desc: Option<String>,
    pub lon: f64,
    pub lat: f64,
}

/// Summarises elevations along a track.
///
/// To work around noise in GPS elevation data, changes only count towards
/// gain or loss once they exceed a threshold.
fn elevation(mut elevations: impl Iterator<Item = f64>) -> Option<Elevation> {
    let first = elevations.next()?;
    let mut summary = Elevation {
        min_m: first,
        max_m: first,
        gain_m: 0.0,
        loss_m: 0.0,
    };

    let mut reference = first;
    for elevation in elevations {
        summary.min_m = summary.min_m.min(elevation);
        summary.max_m = summary.max_m.max(elevation);

        let change = elevation - reference;
        if change.abs() >= ELEVATION_CHANGE_THRESHOLD_METERS {
            if change > 0.0 {
                summary.gain_m += change;
            } else {
                summary.loss_m -= change;
            }
            reference = elevation;
        }
    }

    Some(summary)
}

/// Builds an elevation profile, resampled at evenly spaced distances along
/// the track if it has too many points.
///
/// Cumulative distance does not include gaps between segments.
fn elevation_profile(segments: &[&[gpx::Waypoint]]) -> Vec<(f64, f64)> {
    let mut samples = Vec::new();
    let mut distance = 0.0;
    for points in segments {
        for (index, point) in points.iter().enumerate() {
            if index > 0 {
                distance += HAVERSINE.distance(points[index - 1].point(), point.point());
            }
            if let Some(elevation) = point.elevation {
                samples.push((distance, elevation));
            }
        }
    }

    if samples.len() > ELEVATION_PROFILE_SAMPLES {
        samples = resample(&samples, ELEVATION_PROFILE_SAMPLES);
    }

    samples
        .into_iter()
        .map(|(distance, elevation)| (round_to_tenth(distance), round_to_tenth(elevation)))
        .collect()
}

/// Linearly interpolates `count` evenly spaced samples, by distance, from
/// samples sorted by distance.
#[allow(clippy::cast_precision_loss)]
fn resample(samples: &[(f64, f64)], count: usize) -> Vec<(f64, f64)> {
    let (start, end) = (samples[0].0, samples[samples.len() - 1].0);

    (0..count)
        .map(|index| {
            let target = start + (end - start) * index as f64 / (count - 1) as f64;

            // The pair of samples either side of the target distance.
            let after = samples
                .partition_point(|&(distance, _)| distance < target)
                .clamp(1, samples.len() - 1);
            let (distance_a, elevation_a) = samples[after - 1];
            let (distance_b, elevation_b) = samples[after];

            let span = distance_b - distance_a;
            let t = if span > 0.0 {
                (target - distance_a) / span
            } else {
                0.0
            };

            (target, elevation_a + t * (elevation_b - elevation_a))
        })
        .collect()
}

fn round_to_tenth(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn waypoint(waypoint: &gpx::Waypoint) -> Waypoint {
    let point = waypoint.point();
    Waypoint {
        name: truncate(waypoint.name.as_deref(), MAX_WAYPOINT_NAME_LENGTH)
            .unwrap_or_else(|| "Waypoint".to_string()),
        desc: truncate(waypoint.description.as_deref(), MAX_WAYPOINT_DESC_LENGTH),
        lon: point.x(),
        lat: point.y(),
    }
}

/// Trims the text, returning `None` if it is empty, and caps its length.
fn truncate(text: Option<&str>, max_chars: usize) -> Option<String> {
    let text = text?.trim();
    (!text.is_empty()).then(|| text.chars().take(max_chars).collect())
}
