-- ATProto OAuth storage for the web frontend. The values are JSON documents
-- owned by @atproto/oauth-client-node

-- In-flight authorization requests, keyed by the OAuth `state` parameter.
CREATE TABLE IF NOT EXISTS oauth_states (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_states_created_at_idx ON oauth_states (created_at);

-- Token sets for authenticated accounts, keyed by DID.
CREATE TABLE IF NOT EXISTS oauth_sessions (
    did TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Browser sessions. We only store the SHA-256 hash of the cookie
CREATE TABLE IF NOT EXISTS web_sessions (
    id_hash TEXT PRIMARY KEY,
    did TEXT NOT NULL REFERENCES oauth_sessions (did) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS web_sessions_did_idx ON web_sessions (did);

CREATE INDEX IF NOT EXISTS web_sessions_expires_at_idx ON web_sessions (expires_at);
