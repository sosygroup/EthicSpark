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
