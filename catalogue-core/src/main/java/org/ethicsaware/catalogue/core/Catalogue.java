package org.ethicsaware.catalogue.core;

import java.util.List;
import java.util.Map;

/** Imported catalogue content. Raw cells retain exact text and worksheet coordinates. */
public record Catalogue(String sourceSha256, String importerVersion, List<Cluster> clusters,
                        List<Reference> references, Map<String, RawCell> sourceCells) {
    public static final String IMPORTER_VERSION = "1";

    public enum Category { KNOW, PROTECT, INFORM, ASSESS, VALIDATE, RESPOND }
    public enum Severity { ERROR, WARNING, INFO }
    public record RawCell(String type, String value) {}
    public record Issue(Severity severity, String code, String source, String message) {}
    public record ImportReport(String sourceSha256, String importerVersion, int clusterCount,
                               int actionCount, int referenceCount, List<Issue> issues) {
        public boolean valid() { return issues.stream().noneMatch(i -> i.severity() == Severity.ERROR); }
        public long warningCount() { return issues.stream().filter(i -> i.severity() == Severity.WARNING).count(); }
    }
    public record ImportResult(Catalogue catalogue, ImportReport report) {}
    public record Cluster(String id, String title, String definition, List<String> concerns,
                          String semanticRationale, String boundaries, List<String> referenceIds,
                          List<LabelMapping> labelMappings, List<Action> actions, String source) {}
    public record LabelMapping(String card, String characteristic, String source) {}
    public record Action(String id, Category category, String text, List<String> concerns,
                         String evidence, List<String> phases, boolean allPhases, List<String> roles,
                         List<String> referenceIds, String expertObservations, String source) {}
    public record Reference(String id, String title, String authors, String year, String authority,
                            String links, String source) {}
}
