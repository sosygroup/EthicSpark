CREATE TABLE catalogue_version (
    id text PRIMARY KEY,
    source_sha256 varchar(64) NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
    importer_version text NOT NULL,
    state text NOT NULL CHECK (state = 'IMPORTED'),
    imported_at timestamptz NOT NULL DEFAULT current_timestamp,
    cluster_count integer NOT NULL CHECK (cluster_count = 24),
    action_count integer NOT NULL CHECK (action_count = 144),
    reference_count integer NOT NULL CHECK (reference_count = 184),
    warning_count integer NOT NULL CHECK (warning_count >= 0),
    document jsonb NOT NULL,
    report jsonb NOT NULL,
    source_workbook bytea NOT NULL,
    UNIQUE (source_sha256, importer_version)
);
CREATE TABLE catalogue_reference (
    version_id text NOT NULL REFERENCES catalogue_version(id),
    reference_id text NOT NULL,
    PRIMARY KEY (version_id, reference_id)
);
CREATE TABLE catalogue_cluster (
    version_id text NOT NULL REFERENCES catalogue_version(id),
    cluster_id text NOT NULL,
    PRIMARY KEY (version_id, cluster_id)
);
CREATE TABLE catalogue_action (
    version_id text NOT NULL,
    action_id text NOT NULL,
    cluster_id text NOT NULL,
    category text NOT NULL CHECK (category IN ('KNOW', 'PROTECT', 'INFORM', 'ASSESS', 'VALIDATE', 'RESPOND')),
    PRIMARY KEY (version_id, action_id),
    UNIQUE (version_id, cluster_id, category),
    FOREIGN KEY (version_id, cluster_id) REFERENCES catalogue_cluster(version_id, cluster_id)
);
CREATE TABLE cluster_reference (
    version_id text NOT NULL,
    cluster_id text NOT NULL,
    reference_id text NOT NULL,
    PRIMARY KEY (version_id, cluster_id, reference_id),
    FOREIGN KEY (version_id, cluster_id) REFERENCES catalogue_cluster(version_id, cluster_id),
    FOREIGN KEY (version_id, reference_id) REFERENCES catalogue_reference(version_id, reference_id)
);
CREATE TABLE action_reference (
    version_id text NOT NULL,
    action_id text NOT NULL,
    reference_id text NOT NULL,
    PRIMARY KEY (version_id, action_id, reference_id),
    FOREIGN KEY (version_id, action_id) REFERENCES catalogue_action(version_id, action_id),
    FOREIGN KEY (version_id, reference_id) REFERENCES catalogue_reference(version_id, reference_id)
);

-- Approved versions will be separate records in a later migration. Imported snapshots
-- are append-only, including the original workbook and report.
CREATE FUNCTION reject_catalogue_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Catalogue snapshots are immutable; import a new version';
END;
$$;
CREATE TRIGGER immutable_version BEFORE UPDATE OR DELETE ON catalogue_version FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_reference BEFORE UPDATE OR DELETE ON catalogue_reference FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_cluster BEFORE UPDATE OR DELETE ON catalogue_cluster FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_action BEFORE UPDATE OR DELETE ON catalogue_action FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_cluster_reference BEFORE UPDATE OR DELETE ON cluster_reference FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_action_reference BEFORE UPDATE OR DELETE ON action_reference FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
