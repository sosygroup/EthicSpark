package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.WorkbookImporter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Files;
import java.nio.file.Path;

/** Explicit local startup import. A blocking error aborts startup before a version is saved. */
@Component
public class CatalogueBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(CatalogueBootstrap.class);
    private final CatalogueStore store;
    private final Path source;
    private final Path reportFile;
    private final boolean enabled;

    public CatalogueBootstrap(CatalogueStore store, @Value("${catalogue.import.path}") String source,
                              @Value("${catalogue.import.report}") String report,
                              @Value("${catalogue.import.enabled:true}") boolean enabled) {
        this.store = store; this.source = Path.of(source); this.reportFile = Path.of(report); this.enabled = enabled;
    }

    @Override public void run(ApplicationArguments arguments) throws Exception {
        if (!enabled) return;
        byte[] bytes = Files.readAllBytes(source);
        var result = new WorkbookImporter().read(bytes);
        Path parent = reportFile.toAbsolutePath().getParent();
        Files.createDirectories(parent);
        Files.writeString(reportFile, JsonMapper.builder().build().writerWithDefaultPrettyPrinter().writeValueAsString(result.report()));
        if (!result.report().valid())
            throw new IllegalStateException("Catalogue import failed. Read the validation report: " + reportFile);
        String id = store.save(result, bytes);
        log.info("Catalogue {} imported: {} clusters, {} actions, {} references, {} warnings. State IMPORTED; publication review remains required.",
                id, result.report().clusterCount(), result.report().actionCount(), result.report().referenceCount(), result.report().warningCount());
    }
}
