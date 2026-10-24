-- Tables to model ATProto labels in ATTrails

CREATE TABLE IF NOT EXISTS labels (
    -- The AtUri of the record being labelled
    uri TEXT NOT NULL,
    -- The CID of the specific version of the record being labelled
    cid TEXT NOT NULL,
    -- The label produced for the record
    val TEXT NOT NULL,
    -- When the label was produced
    cts TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Who produced the label: e.g. Jev, Human, LLM, etc.
    source TEXT NOT NULL,
    PRIMARY KEY (uri, cid, val)
);

CREATE INDEX labels_uri_idx ON labels (uri);
