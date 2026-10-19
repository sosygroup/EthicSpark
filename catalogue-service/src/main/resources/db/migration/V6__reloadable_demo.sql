-- Created only on explicit request; no project is seeded at application startup.
CREATE TABLE assistant_demo (
    name text PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES assistant_thread(id)
);
