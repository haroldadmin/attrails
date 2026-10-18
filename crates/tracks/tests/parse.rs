use tracks::TrackData;

fn read(file_name: &str) -> Vec<u8> {
    let path = format!("{}/tests/data/{file_name}", env!("CARGO_MANIFEST_DIR"));
    std::fs::read(path).unwrap()
}

fn assert_close(actual: f64, expected: f64, tolerance: f64) {
    assert!(
        (actual - expected).abs() <= tolerance,
        "expected {expected} ± {tolerance}, got {actual}"
    );
}

#[test]
fn rejects_malformed_xml() {
    for xml in [
        "",
        r#"<?xml version="1.0"?>"#,
        r#"<?xml version="1.0"?><gpx>"#,
    ] {
        assert!(
            TrackData::from_bytes(xml.as_bytes()).is_err(),
            "parsed {xml:?}"
        );
    }
}

#[test]
fn rejects_files_without_usable_points() {
    for xml in [
        r#"<gpx version="1.1"></gpx>"#,
        r#"<gpx version="1.1"><trk></trk></gpx>"#,
        r#"<gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>"#,
        r#"<gpx version="1.1"><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>"#,
        r#"<gpx version="1.1"><trk><trkseg><trkpt lat="1000" lon="1000"/><trkpt lat="1" lon="1"/></trkseg></trk></gpx>"#,
        "<kml></kml>",
    ] {
        assert!(
            TrackData::from_bytes(xml.as_bytes()).is_err(),
            "parsed {xml:?}"
        );
    }
}

#[test]
fn reads_routes_after_tracks() {
    let xml = r#"<gpx version="1.1">
        <trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk>
        <rte><rtept lat="10" lon="10"/><rtept lat="11" lon="11"/></rte>
    </gpx>"#;

    let track = TrackData::from_bytes(xml.as_bytes()).unwrap();
    assert_eq!(track.point_count, 4);
    assert_eq!(track.start_point.x_y(), (1.0, 1.0));
    assert_eq!(track.end_point.x_y(), (11.0, 11.0));
    assert_eq!(track.path.0.len(), 2);
}

#[test]
fn reads_waypoints() {
    let xml = r#"<gpx version="1.1">
        <wpt lat="1" lon="2"><name> Caf&#233; &amp; shop </name><desc><![CDATA[Open <daily>]]></desc></wpt>
        <wpt lat="3" lon="4"><name>   </name></wpt>
        <trk><name>Not a waypoint</name><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk>
    </gpx>"#;

    let track = TrackData::from_bytes(xml.as_bytes()).unwrap();
    let waypoints: Vec<_> = track
        .waypoints
        .iter()
        .map(|w| (w.name.as_str(), w.desc.as_deref(), w.lon, w.lat))
        .collect();
    assert_eq!(
        waypoints,
        [
            ("Café & shop", Some("Open <daily>"), 2.0, 1.0),
            ("Waypoint", None, 4.0, 3.0),
        ]
    );
}

// Reference values for distance and elevation are from https://gpx.studio
#[test]
fn parses_cotswolds() {
    let track = TrackData::from_bytes(&read("cotswolds-classic-middle-2023.gpx")).unwrap();

    assert!(track.is_loop);
    assert_close(track.distance_m, 81270.0, 10.0);
    let elevation = track.elevation.unwrap();
    assert_close(elevation.gain_m, 746.0, 5.0);
    assert_close(elevation.loss_m, 746.0, 5.0);
    assert_close(elevation.min_m, 30.5, 1e-6);
    assert_close(elevation.max_m, 315.8, 1e-6);
    assert_eq!(track.elevation_profile.len(), 200);
    assert!(track.waypoints.is_empty());
}

#[test]
fn parses_lejog() {
    let track = TrackData::from_bytes(&read("lejog.gpx")).unwrap();

    assert!(!track.is_loop);
    assert_close(track.distance_m, 1_753_540.0, 10.0);
    assert_no_elevation(&track);
    assert!(track.waypoints.is_empty());
}

#[test]
fn parses_london_to_brighton() {
    let track = TrackData::from_bytes(&read("london-to-brighton.gpx")).unwrap();

    assert!(!track.is_loop);
    assert_close(track.distance_m, 97580.0, 10.0);
    assert_no_elevation(&track);
}

#[test]
fn parses_london_to_hastings() {
    let track = TrackData::from_bytes(&read("london-to-hastings.gpx")).unwrap();

    assert!(!track.is_loop);
    assert_close(track.distance_m, 91730.0, 10.0);
    let elevation = track.elevation.unwrap();
    assert_close(elevation.gain_m, 1425.0, 150.0);
    assert_close(elevation.loss_m, 1503.0, 150.0);
    assert_close(elevation.min_m, 5.0, 1e-6);
    assert_close(elevation.max_m, 209.0, 1e-6);
    assert!(!track.elevation_profile.is_empty());
}

fn assert_no_elevation(track: &tracks::TrackData) {
    assert_eq!(track.elevation, None);
    assert!(track.elevation_profile.is_empty());
}
