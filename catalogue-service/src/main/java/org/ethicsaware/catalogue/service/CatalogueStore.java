package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.Catalogue;
import org.ethicsaware.catalogue.core.Catalogue.ImportResult;
import org.ethicsaware.catalogue.core.WorkbookImporter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Immutable JSONB snapshots plus relational reference constraints. No update/delete API. */
@Repository
public class CatalogueStore {
    private final JdbcTemplate jdbc;
    private final JsonMapper json = JsonMapper.builder().build();

    public CatalogueStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Version(String id, String sourceSha256, String importerVersion, String state,
                          Instant importedAt, int clusterCount, int actionCount, int referenceCount, long warningCount) {}

    public static String versionId(String digest) { return "sha256-" + digest + "-importer-" + Catalogue.IMPORTER_VERSION; }

    @Transactional
    public String save(ImportResult result, byte[] originalWorkbook) {
        if (!result.report().valid()) throw new IllegalArgumentException("Invalid imports cannot be persisted as catalogue versions.");
        if (!WorkbookImporter.sha256(originalWorkbook).equals(result.catalogue().sourceSha256()))
            throw new IllegalArgumentException("Workbook digest does not match the imported content.");
        String id = versionId(result.catalogue().sourceSha256());
        int inserted = jdbc.update("""
                INSERT INTO catalogue_version
                  (id, source_sha256, importer_version, state, cluster_count, action_count, reference_count, warning_count, document, report, source_workbook)
                VALUES (?, ?, ?, 'IMPORTED', ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?)
                ON CONFLICT (source_sha256, importer_version) DO NOTHING
                """, id, result.catalogue().sourceSha256(), result.catalogue().importerVersion(), result.report().clusterCount(),
                result.report().actionCount(), result.report().referenceCount(), result.report().warningCount(),
                encode(result.catalogue()), encode(result.report()), originalWorkbook);
        if (inserted == 0) return id;
        for (var ref : result.catalogue().references())
            jdbc.update("INSERT INTO catalogue_reference(version_id, reference_id) VALUES (?, ?)", id, ref.id());
        for (var cluster : result.catalogue().clusters()) {
            jdbc.update("INSERT INTO catalogue_cluster(version_id, cluster_id) VALUES (?, ?)", id, cluster.id());
            for (String ref : cluster.referenceIds().stream().distinct().toList())
                jdbc.update("INSERT INTO cluster_reference(version_id, cluster_id, reference_id) VALUES (?, ?, ?)", id, cluster.id(), ref);
            for (var action : cluster.actions()) {
                jdbc.update("INSERT INTO catalogue_action(version_id, action_id, cluster_id, category) VALUES (?, ?, ?, ?)", id, action.id(), cluster.id(), action.category().name());
                for (String ref : action.referenceIds().stream().distinct().toList())
                    jdbc.update("INSERT INTO action_reference(version_id, action_id, reference_id) VALUES (?, ?, ?)", id, action.id(), ref);
            }
        }
        return id;
    }

    public List<Version> versions() {
        return jdbc.query("SELECT * FROM catalogue_version ORDER BY imported_at DESC, id", (rs, n) -> new Version(
                rs.getString("id"), rs.getString("source_sha256"), rs.getString("importer_version"), rs.getString("state"),
                rs.getTimestamp("imported_at").toInstant(), rs.getInt("cluster_count"), rs.getInt("action_count"),
                rs.getInt("reference_count"), rs.getLong("warning_count")));
    }

    public Optional<Catalogue> catalogue(String id) {
        return jdbc.query("SELECT document::text FROM catalogue_version WHERE id = ?", (rs, n) -> json.readValue(rs.getString(1), Catalogue.class), id).stream().findFirst();
    }

    public Optional<Catalogue.ImportReport> report(String id) {
        return jdbc.query("SELECT report::text FROM catalogue_version WHERE id = ?", (rs, n) -> json.readValue(rs.getString(1), Catalogue.ImportReport.class), id).stream().findFirst();
    }

    private String encode(Object value) { return json.writeValueAsString(value); }
}
