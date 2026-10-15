CREATE TABLE workflow_project (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    catalogue_version text NOT NULL REFERENCES catalogue_version(id),
    revision integer NOT NULL DEFAULT 0,
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE TABLE profile_version (
    project_id uuid NOT NULL REFERENCES workflow_project(id),
    version integer NOT NULL,
    document jsonb NOT NULL,
    confirmed_by text NOT NULL,
    confirmed_at timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY(project_id, version)
);
CREATE TABLE review_event (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES workflow_project(id),
    document jsonb NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE TABLE plan_version (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES workflow_project(id),
    version integer NOT NULL,
    request_key uuid NOT NULL,
    request_revision integer NOT NULL,
    document jsonb NOT NULL,
    approved_at timestamptz NOT NULL DEFAULT current_timestamp,
    UNIQUE(project_id, version),
    UNIQUE(project_id, request_key)
);
CREATE TRIGGER immutable_profile BEFORE UPDATE OR DELETE ON profile_version FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_review BEFORE UPDATE OR DELETE ON review_event FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
CREATE TRIGGER immutable_plan BEFORE UPDATE OR DELETE ON plan_version FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
