# Replication package preparation

This repository is the working software artefact for the draft paper **Bridging Concept and Practice: A Developer-Facing Catalogue for Ethics-Aware Software Engineering**. This is a public software development baseline, not a complete replication package or an evaluated tool release. The primary UI is now a conversational desktop workspace; the earlier structured workflow is retained for historical projects. See [conversational workspace](CONVERSATIONAL_WORKSPACE.md).

## Included artefacts

| Artefact | Location | Purpose |
| --- | --- | --- |
| Catalogue source | `data/catalogue-public.xlsx` | Public input for the importer, including source IDs and bibliographic registry |
| Catalogue import report | `docs/validation/catalogue-import-report.json` | Source-review warnings and canonicalisation decisions for the supplied workbook |
| Import rules and implementation | `catalogue-core/` | Deterministic catalogue extraction and validation |
| Application and schema | `catalogue-service/` | Project workflow, immutable approvals and Flyway migrations |
| User interface | `catalogue-web/` | English React/Material UI manual workflow |
| Walkthrough | `docs/MANUAL_WORKFLOW.md` | Repeatable illustrative C-01 usage scenario |
| Automated checks | `scripts/test.sh` and module test sources | Import and real-PostgreSQL integration checks |
| Design and boundaries | `docs/MVP_SPECIFICATION.md`, `docs/ARCHITECTURE.md`, `docs/VALIDATION.md` | Intended behaviour, implemented scope and verification limits |

The distributed workbook omits General research notes and individual expert observations. The original remains local. See [data provenance](DATA_PROVENANCE.md) for the exact transformation, source hashes and preservation checks. The importer retains the distributed workbook in each snapshot.

Paper drafts, the developer handoff DOCX, local credentials, database volumes, downloaded exports, temporary analysis files and build products are not included. The browser-generated screenshots use an explicitly illustrative Demo project. The example is not evidence of empirical effectiveness.

## Reproduce the current software baseline

1. Clone the repository and enter its directory. The catalogue workbook is already included.
2. Start Docker Desktop or Docker Engine with Compose v2. Shell instructions use a POSIX shell; Windows users can run them in WSL2 with Docker integration.
3. Run `./scripts/run.sh`. The first build downloads pinned Java/Node images and package dependencies, generates local database credentials and imports the workbook.
4. Open http://localhost:8082. Choose Start with an example and supply a reviewer name. No existing project database or browser storage is required.
5. For the current primary UI follow `docs/CONVERSATIONAL_WORKSPACE.md` and launch `./scripts/desktop.sh`. A real model connection is needed for conversational responses. The legacy manual workflow remains at `/?legacy=1` and needs no model credentials. Source-distributed desktop dependencies are documented; native actions require a local graphical session.
6. Run `./scripts/test.sh` to build and validate against an isolated PostgreSQL instance. It does not use the normal application database. The Java suite contains 13 importer tests and 15 integration cases, including six conversational cases. Seven separate native-agent tests exercise permission decisions, real temporary file changes and child processes. Provider tests use local HTTP stubs, not live inference.
7. Save the Git commit SHA, test log and exports with any reported observations. `git rev-parse HEAD` identifies the source baseline.

The first build requires network access to container and package registries. Subsequent use depends on local caches. Java/Node/Maven versions, application dependencies and container image digests are specified in the repository. Timestamps, project/plan UUIDs and reviewer labels vary between runs; compare source content, state transitions, included entries and disclosed gaps rather than byte-identical whole exports.

Expected import result: 24 clusters, 144 actions, R-001 through R-184, zero blocking errors and 179 recorded source-review warnings for SHA-256 `e51a3127bf1e667f5a9257b91cd5130adeaa0b2ea9915f677b685b22988a396f` under importer version 2. See the import report for warning details; valid IDs do not prove substantive bibliographic support.

Expected conversational result: a persisted conversation from a free prompt, relevant catalogue citations where warranted, optional requested file context, generated text documents and separate proposed operations. Native changes/commands occur only after concrete preview and approval. The previous structured workflow still preserves confirmed profiles, review decisions and immutable approved plans; those historical records are not converted into model evaluations.

## Relationship to the paper

The source workbook and importer instantiate the catalogue structure. The current tool supports manual and assisted catalogue application. Adapter tests establish transport and schema behaviour; no live-provider quality evaluation has been performed. The repository does not yet contain the original expert-interview dataset, full analysis scripts or an empirical evaluation of the tool. The catalogue's reported expert validation must not be presented as validation of the tool's usability or effectiveness.

The paper's final claims, replication datasets and analysis procedures must be reconciled with the released artefact before submission. A public version may also need a review-appropriate anonymous distribution; this named repository is public.

## Decisions before the paper replication release

- Confirm the author/contributor list and software/data licensing. No software or data licence has yet been assigned.
- Review permissions and third-party material for the final paper artefacts. Participant notes and original research inputs are excluded from this software distribution.
- Add the appropriate catalogue-validation datasets, analysis scripts and study protocols, or explain any access restrictions.
- Freeze the implemented scope and identify which paper claims the artefacts substantiate.
- Validate the final demonstration cases and tests from a clean checkout on the documented platforms.
- Create a versioned release/tag after agreement on the paper baseline; record checksums and a persistent archive identifier when available.
- Add final citation metadata, paper reference and repository/archive links without placeholder DOI or acceptance claims.

Public visibility permits anyone to inspect the repository. Write access is managed through GitHub permissions and does not automatically extend to coauthors.
