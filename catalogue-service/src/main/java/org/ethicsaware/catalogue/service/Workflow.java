package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.Catalogue;
import java.time.Instant;
import java.util.*;

public final class Workflow {
    private Workflow() {}
    public static final List<String> FIELD_IDS = List.of("purpose", "stakeholders", "data", "behaviour", "phase", "retention", "sharing", "safeguards", "additional");
    public static final String NO_SHARING = "We do not share any personal data with third parties.";
    public record Field(String id, String value, String status, List<UUID> files, List<UUID> companyEthics) {
        public Field { files=files==null?List.of():List.copyOf(files); companyEthics=companyEthics==null?List.of():List.copyOf(companyEthics); }
        public Field(String id,String value,String status) { this(id,value,status,List.of(),List.of()); }
    }
    public record Profile(int version, boolean confirmed, List<Field> fields) {}
    public record Recommendation(String sourceActionId, String scenario, String action, String evidence,
                                 String criterion, String owner, String rationale, List<String> phases,
                                 String reviewStatus, String implementationStatus, String reason, String applicability, String applicabilityReason) {
        public Recommendation { applicability=applicability==null?"suitable":applicability; applicabilityReason=applicabilityReason==null?"":applicabilityReason; }
        public Recommendation(String id,String scenario,String action,String evidence,String criterion,String owner,String rationale,List<String> phases,String review,String implementation,String reason) {
            this(id,scenario,action,evidence,criterion,owner,rationale,phases,review,implementation,reason,"suitable","");
        }
    }
    public record Project(UUID id, String name, String catalogueVersion, int revision, Profile profile,
                          List<String> selectedClusters, List<Recommendation> recommendations, Reasoning.Run reasoning) {
        public Project(UUID id,String name,String catalogueVersion,int revision,Profile profile,List<String> selectedClusters,List<Recommendation> recommendations) {
            this(id,name,catalogueVersion,revision,profile,selectedClusters,recommendations,null);
        }
    }
    public record Summary(UUID id, String name, int revision, int profileVersion, boolean confirmed, Instant updatedAt) {}
    public record Event(UUID id, String actor, Instant at, String operation, String sourceActionId,
                        String reason, Object before, Object after) {}
    public record Entry(Recommendation recommendation, Catalogue.Action source) {}
    public record AttachmentSummary(UUID id,String fieldId,String name,int size,String sha256,String extraction) {}
    public record Plan(UUID id, UUID projectId, String projectName, String kind, int version,
                       String catalogueVersion, int projectRevision, Profile profile, String actor,
                       Instant at, List<Entry> entries, List<String> gaps, List<String> excludedActionIds,
                       String origin, Reasoning.Run reasoning, List<AttachmentSummary> attachments) {
        public Plan { attachments=attachments==null?List.of():List.copyOf(attachments); }
    }
    public record PlanSummary(UUID id, int version, Instant approvedAt) {}
    public record Create(String name, String actor) {}
    public record ProfileChange(int revision, String actor, List<Field> fields, boolean confirm) {}
    public record SelectionChange(int revision, String actor, List<String> clusterIds) {}
    public record RecommendationChange(int revision, String actor, Recommendation recommendation, String decision) {}
    public record Approval(int revision, String actor, UUID requestKey) {}
}
