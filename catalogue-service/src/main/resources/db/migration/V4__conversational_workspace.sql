CREATE TABLE assistant_project (
    id uuid PRIMARY KEY REFERENCES workflow_project(id),
    name text NOT NULL,
    catalogue_version text NOT NULL REFERENCES catalogue_version(id),
    created_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE TABLE assistant_thread (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES assistant_project(id),
    title text NOT NULL,
    revision integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE TABLE assistant_message (
    id uuid PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES assistant_thread(id),
    request_key uuid,
    request_fingerprint text,
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    sequence bigint GENERATED ALWAYS AS IDENTITY,
    UNIQUE(thread_id,request_key)
);
CREATE INDEX assistant_messages_thread ON assistant_message(thread_id,sequence);
CREATE TABLE assistant_receipt (
    id uuid PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES assistant_message(id),
    operation_id text NOT NULL,
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    UNIQUE(message_id,operation_id)
);
CREATE TRIGGER immutable_assistant_receipt BEFORE UPDATE OR DELETE ON assistant_receipt FOR EACH ROW EXECUTE FUNCTION reject_catalogue_mutation();
