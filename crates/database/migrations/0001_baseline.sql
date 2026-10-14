CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS routes (
    uri TEXT PRIMARY KEY,
    cid TEXT NOT NULL,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    activity TEXT NOT NULL,
    surface TEXT,
    difficulty TEXT,
    tags TEXT[] NOT NULL,
    images JSONB NOT NULL,
    details JSONB NOT NULL,
    sort_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    tombstoned BOOLEAN NOT NULL,
    gpx_cid TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS routes_sort_at_idx ON routes (sort_at);

CREATE INDEX IF NOT EXISTS routes_activity_sort_at_idx ON routes (activity, sort_at);

CREATE INDEX IF NOT EXISTS routes_did_idx ON routes (did);

CREATE TABLE IF NOT EXISTS reviews (
    uri TEXT PRIMARY KEY,
    cid TEXT NOT NULL,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    subject_uri TEXT NOT NULL,
    subject_cid TEXT NOT NULL,
    rating INTEGER NOT NULL,
    body TEXT,
    images JSONB NOT NULL,
    sort_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    tombstoned BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS reviews_did_idx ON reviews (did);

CREATE INDEX IF NOT EXISTS reviews_subject_uri_idx ON reviews (subject_uri);

CREATE INDEX IF NOT EXISTS reviews_sort_at_idx ON reviews (sort_at);

CREATE TABLE IF NOT EXISTS users (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    cid TEXT NOT NULL,
    name TEXT NOT NULL,
    bio TEXT,
    profile_picture_uri JSONB,
    sort_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    tombstoned BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS users_did_idx ON users (did);

CREATE TABLE IF NOT EXISTS tracks (
    cid TEXT PRIMARY KEY,
    parser_version INTEGER NOT NULL,
    distance_m DOUBLE PRECISION NOT NULL CHECK (distance_m >= 0),
    point_count INTEGER NOT NULL CHECK (point_count >= 2),
    elevation_gain_m REAL,
    elevation_loss_m REAL,
    min_elevation_m REAL,
    max_elevation_m REAL,
    duration_sec INTEGER,
    moving_time_sec INTEGER,
    is_loop BOOLEAN NOT NULL,
    start_point GEOGRAPHY (POINT, 4326) NOT NULL,
    end_point GEOGRAPHY (POINT, 4326) NOT NULL,
    path GEOGRAPHY (MULTILINESTRING, 4326),
    elevation_profile JSONB,
    waypoints JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (
        jsonb_typeof(waypoints) = 'array'
    ),
    -- Attached to processed_at but checks elevation_profile, as in the
    -- original migration; Postgres names it tracks_elevation_profile_check.
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL CHECK (
        elevation_profile IS NULL OR jsonb_typeof(elevation_profile) = 'array'
    )
);

CREATE INDEX IF NOT EXISTS tracks_path_gix ON tracks USING gist (path);

CREATE INDEX IF NOT EXISTS tracks_start_gix ON tracks USING gist (start_point);

CREATE INDEX IF NOT EXISTS tracks_distance_idx ON tracks (distance_m);
