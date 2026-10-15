package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.Catalogue;
import org.ethicsaware.catalogue.core.WorkbookImporter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.*;

/** Runs only with -Pintegration against a dedicated real PostgreSQL database. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {"catalogue.import.enabled=false"})
class CatalogueServiceIT {
    @Autowired CatalogueStore store;
    @Autowired JdbcTemplate jdbc;
    @Value("${local.server.port}") int port;
    private final HttpClient http = HttpClient.newHttpClient();
    private final JsonMapper json = JsonMapper.builder().build();

    @Test void importsAtomicallyPersistsExactSourceAndServesVersionScopedApi() throws Exception {
        byte[] bytes = Files.readAllBytes(Path.of(System.getProperty("catalogue.test.workbook")));
        var imported = new WorkbookImporter().read(bytes);
        String version = store.save(imported, bytes);
        int before = store.versions().size();
        assertThat(store.save(imported, bytes)).isEqualTo(version);
        assertThat(store.versions()).hasSize(before);
        assertThat(store.catalogue(version).orElseThrow()).isEqualTo(imported.catalogue());
        assertThat(store.report(version).orElseThrow()).isEqualTo(imported.report());
        assertThat(jdbc.queryForObject("SELECT source_workbook FROM catalogue_version WHERE id=?", byte[].class, version)).isEqualTo(bytes);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM catalogue_action WHERE version_id=?", Integer.class, version)).isEqualTo(144);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM catalogue_reference WHERE version_id=?", Integer.class, version)).isEqualTo(184);
        String base = "/api/catalogue/versions/" + version;
        assertThat(get(base + "/clusters").size()).isEqualTo(24);
        assertThat(get(base + "/clusters/C-01").get("actions").size()).isEqualTo(6);
        assertThat(get(base + "/actions?category=VALIDATE").size()).isEqualTo(24);
        assertThat(get(base + "/references").size()).isEqualTo(184);
        assertThat(get(base + "/references/R-184").get("id").asText()).isEqualTo("R-184");
        assertThat(get(base + "/source-cells?locator=C01!C28").get("value").asText()).isEqualTo(imported.catalogue().clusters().getFirst().actions().getFirst().text());
        assertThat(get(base + "/report").get("clusterCount").asInt()).isEqualTo(24);
        assertThat(status(base + "/clusters/absent")).isEqualTo(404);
        assertThat(status("/api/catalogue/versions/absent/clusters")).isEqualTo(404);
        assertThat(status(base + "/actions?category=VERIFY")).isEqualTo(400);
        assertThat(http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + base)).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(405);
        assertThatThrownBy(() -> jdbc.update("UPDATE catalogue_version SET state='IMPORTED' WHERE id=?", version)).hasMessageContaining("immutable");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO action_reference(version_id,action_id,reference_id) VALUES (?,?,?)", version,"C01-A1","R-999")).hasMessageContaining("foreign key");
        assertThatThrownBy(() -> store.save(new Catalogue.ImportResult(imported.catalogue(), new Catalogue.ImportReport(
                imported.report().sourceSha256(), Catalogue.IMPORTER_VERSION, 24, 144, 184,
                java.util.List.of(new Catalogue.Issue(Catalogue.Severity.ERROR, "TEST", "TEST", "Invalid input")))), bytes))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(store.versions()).hasSize(before);
        // A new reviewed source creates a separate snapshot. Repeated source links are
        // retained in the document/report, while relational membership stays unique.
        byte[] revisedBytes;
        try (var workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(bytes));
             var out = new java.io.ByteArrayOutputStream()) {
            var cell = workbook.getSheet("C01").getRow(4).getCell(6);
            cell.setCellValue(cell.getStringCellValue() + "; R-097");
            workbook.write(out);
            revisedBytes = out.toByteArray();
        }
        var revised = new WorkbookImporter().read(revisedBytes);
        assertThat(revised.report().valid()).isTrue();
        assertThat(revised.report().issues()).anyMatch(i -> i.code().equals("DUPLICATE_REFERENCE_LINK"));
        String revisedVersion = store.save(revised, revisedBytes);
        assertThat(revisedVersion).isNotEqualTo(version);
        assertThat(store.versions()).hasSize(before + 1);
        assertThat(store.catalogue(version).orElseThrow()).isEqualTo(imported.catalogue());
        assertThat(store.catalogue(revisedVersion).orElseThrow()).isEqualTo(revised.catalogue());
    }

    private JsonNode get(String path) throws Exception {
        var response = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        return json.readTree(response.body());
    }
    private int status(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(), HttpResponse.BodyHandlers.ofString()).statusCode();
    }
}
