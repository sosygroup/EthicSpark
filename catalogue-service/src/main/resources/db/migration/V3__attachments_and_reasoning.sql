CREATE TABLE profile_attachment (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES workflow_project(id),
    field_id text NOT NULL,
    document jsonb NOT NULL,
    content bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX attachment_project ON profile_attachment(project_id);
CREATE TABLE reasoning_run (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES workflow_project(id),
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE TRIGGER immutable_attachment BEFORE UPDATE OR DELETE ON profile_attachment FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_reasoning BEFORE UPDATE OR DELETE ON reasoning_run FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
