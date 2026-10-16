# Local operation and recovery

Run `./scripts/run.sh` to initialise credentials, build and start the local application. Keep `.env` private. The configured database password is used when PostgreSQL first initialises the data directory; editing it later does not change the password of an existing database user.

The source workbook is bundled in the image and readable by the non-root runtime user. Replace the input with a reviewed new source and run `./scripts/run.sh` again to rebuild the image and import a new version. Existing versions remain available. Catalogue warnings are retained and must be resolved or explicitly dispositioned before a later publication workflow. No host bind mounts are required.

## Back up

Backups contain the original workbook, catalogue snapshots and reports. Store them according to the project's data policy. From the project directory:

```sh
mkdir -p tmp/backups
docker compose exec -T database pg_dump -U catalogue -d ethics_catalogue -Fc > tmp/backups/catalogue.dump
```

Keep a separate copy of `.env` and the reviewed source input. The database password is not included in `pg_dump`.

## Restore into a separate database

Do not restore over the active database. Create a separate empty database and restore there:

```sh
docker compose exec -T database createdb -U catalogue ethics_catalogue_restored
docker compose exec -T database pg_restore -U catalogue -d ethics_catalogue_restored --exit-on-error < tmp/backups/catalogue.dump
```

Inspect restored version counts and reports before switching a service's `DB_URL`. Preserve the original database until recovery is confirmed. The immutable-table triggers are included in the dump.

## Readiness and diagnostics

`/actuator/health/readiness` includes database connectivity and startup readiness. The container health check uses the same endpoint. Inspect `docker compose logs application` for startup failures; a structurally invalid workbook writes its validation report before aborting. Unreadable/corrupt files fail with a startup log diagnostic.

Stop with `docker compose stop`. Avoid deleting the database volume when preserving work. The test script uses a separate ephemeral PostgreSQL service and does not reset the development database.


## Attachments and model providers

Flyway V3 stores uploaded bytes, extracted text and reasoning runs in PostgreSQL. The normal database backup includes them; treat backups and plan exports as project data. Removing an attachment from a new profile does not delete its historical bytes. Confirmed profiles and approved plans remain immutable.

See [assisted workflow](ASSISTED_WORKFLOW.md) for provider configuration. Change API keys only in the local ignored `.env`, then recreate the application with `./scripts/run.sh`. Avoid `docker compose config` in shared logs because it expands secrets. Do not expose this unauthenticated local workspace as a public multi-user service.


## Conversational desktop operation

Use `./scripts/desktop.sh` for the native window and local file agent, or `./scripts/run.sh` for browser-only chat. Flyway V4 adds conversation and operation-receipt tables. Backups include chats, generated artefacts and stored command output. Linked project files remain in the developer's own folder and are not part of the database backup. Folder-link configuration is local to the Electron user-data directory; it is not distributed in Git.

An interrupted pending model request can be marked stopped from the conversation. Provider execution may still complete remotely; late results cannot overwrite cancellation. Native commands have a bounded lifetime and are stopped on app exit. Closing the app does not stop Docker services; use `docker compose stop` when needed. See [conversational workspace](CONVERSATIONAL_WORKSPACE.md) for trust boundaries and limits.

## Project lifecycle and local-model recovery

Flyway V5 adds a reversible project Trash marker. Deleted projects and their conversations are hidden from active views; attachments, artifacts and immutable receipts remain in the database and backups. Restore from Trash does not reconnect the native folder automatically. No permanent purge is implemented. Rename updates the conversational and historical workflow representations atomically.

Ollama configuration is passed through Compose from the ignored local `.env`: `OLLAMA_TIMEOUT_SECONDS` (default 600, range 1–1800), `OLLAMA_MAX_OUTPUT_TOKENS` (default 8192, range 512–16000) and `OLLAMA_REASONING_EFFORT` (default low; empty uses the model default). Recreate the application after changing settings. A timeout is distinct from a failed connection: if model listing succeeds, inspect local model processing time before changing endpoints. See [Ollama troubleshooting](CONVERSATIONAL_WORKSPACE.md#ollama-troubleshooting).

Use Retry with saved context after a model failure, including a failed first response. Stop pending responses before deleting projects or restarting the backend. Reopen the desktop app after updating native bridge code so Open folder and the other native controls use the current implementation.
