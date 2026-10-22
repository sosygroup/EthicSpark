-- Records one-time initialization, so deleting the demo does not recreate it on every restart.
CREATE TABLE workspace_initialization (
    name text PRIMARY KEY,
    initialized_at timestamptz NOT NULL DEFAULT current_timestamp
);
