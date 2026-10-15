package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.Catalogue;
import java.time.Instant;
import java.util.*;

public final class Workflow {
    private Workflow() {}
    public static final List<String> FIELD_IDS = List.of("purpose", "stakeholders", "data", "behaviour", "phase", "retention", "sharing", "safeguards");
    public record Field(String id, String value, String status) {}
    public record Profile(int version, boolean confirmed, List<Field> fields) {}
    public record Recommendation(String sourceActionId, String scenario, String action, String evidence,
                                 String criterion, String owner, String rationale, List<String> phases,
                                 String reviewStatus, String implementationStatus, String reason) {}
    public record Project(UUID id, String name, String catalogueVersion, int revision, Profile profile,
                          List<String> selectedClusters, List<Recommendation> recommendations) {}
    public record Summary(UUID id, String name, int revision, int profileVersion, boolean confirmed, Instant updatedAt) {}
    public record Event(UUID id, String actor, Instant at, String operation, String sourceActionId,
                        String reason, Object before, Object after) {}
    public record Entry(Recommendation recommendation, Catalogue.Action source) {}
    public record Plan(UUID id, UUID projectId, String projectName, String kind, int version,
                       String catalogueVersion, int projectRevision, Profile profile, String actor,
                       Instant at, List<Entry> entries, List<String> gaps, List<String> excludedActionIds,
                       String origin) {}
    public record PlanSummary(UUID id, int version, Instant approvedAt) {}
    public record Create(String name, String actor) {}
    public record ProfileChange(int revision, String actor, List<Field> fields, boolean confirm) {}
    public record SelectionChange(int revision, String actor, List<String> clusterIds) {}
    public record RecommendationChange(int revision, String actor, Recommendation recommendation, String decision) {}
    public record Approval(int revision, String actor, UUID requestKey) {}
}
