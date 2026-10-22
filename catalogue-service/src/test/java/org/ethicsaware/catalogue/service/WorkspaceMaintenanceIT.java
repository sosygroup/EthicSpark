package org.ethicsaware.catalogue.service;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.ethicsaware.catalogue.core.WorkbookImporter;
import tools.jackson.databind.json.JsonMapper;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.ethicsaware.catalogue.service.Assistant.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"catalogue.import.enabled=false"})
class WorkspaceMaintenanceIT {
    @Autowired WorkspaceMaintenance maintenance;
    @Autowired AssistantService assistant;
    @Autowired AttachmentService attachments;
    @Autowired CatalogueStore catalogues;
    @Autowired JdbcTemplate db;
    static final JsonMapper JSON=JsonMapper.builder().build();
    @BeforeEach void catalogue() throws Exception {byte[] source=Files.readAllBytes(Path.of(System.getProperty("catalogue.test.workbook")));catalogues.save(new WorkbookImporter().read(source),source);}
    @Test void resetRequiresExactConfirmationAndAnUnchangedReviewedSnapshot() {
        var before=maintenance.snapshot();
        assertThatThrownBy(()->maintenance.reset(new WorkspaceMaintenance.ResetRequest("reset",before.snapshotToken()))).hasMessageContaining("Type RESET");
        var p=assistant.createProject(new CreateProject("New data after review"));
        assertThatThrownBy(()->maintenance.reset(new WorkspaceMaintenance.ResetRequest("RESET",before.snapshotToken()))).hasMessageContaining("workspace changed");
        assertThat(assistant.project(p.id()).name()).isEqualTo("New data after review");
    }
    @Test void runningRequestsNativeApprovalsAndPendingResponsesBlockReset() {
        var p=assistant.createProject(new CreateProject("Active operation"));var snapshot=maintenance.snapshot();
        var lease=maintenance.beginOperation(p.id());
        try {maintenance.renewOperation(lease);assertThat(maintenance.snapshot().available()).isFalse();assertThatThrownBy(()->maintenance.reset(new WorkspaceMaintenance.ResetRequest("RESET",snapshot.snapshotToken()))).hasMessageContaining("running requests");}
        finally {maintenance.endOperation(lease);}
        assertThatThrownBy(()->maintenance.renewOperation(lease)).hasMessageContaining("expired");
        maintenance.enterRequest();try {assertThatThrownBy(()->maintenance.reset(new WorkspaceMaintenance.ResetRequest("RESET",snapshot.snapshotToken()))).hasMessageContaining("running requests");}finally{maintenance.leaveRequest();}
        var t=assistant.createThread(new CreateThread(p.id()));var id=UUID.randomUUID();
        db.update("INSERT INTO assistant_message(id,thread_id,document) VALUES (?,?,CAST(? AS jsonb))",id,t.id(),"{\"status\":\"pending\"}");
        try {assertThat(maintenance.snapshot().available()).isFalse();assertThatThrownBy(()->maintenance.reset(new WorkspaceMaintenance.ResetRequest("RESET",maintenance.snapshot().snapshotToken()))).hasMessageContaining("pending model responses");}
        finally{db.update("DELETE FROM assistant_message WHERE id=?",id);}
    }
    @Test void archivalExportIncludesTrashAndBinaryAttachmentsAndResetKeepsCatalogue() throws Exception {
        var p=assistant.createProject(new CreateProject("Preserve in export"));
        var t=assistant.createThread(new CreateThread(p.id()));
        var file=attachments.upload(p.id(),"additional",new org.springframework.mock.web.MockMultipartFile("file","notes.txt","text/plain","Attachment evidence".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assistant.trashProject(p.id());var demo=assistant.loadDemo();
        db.update("INSERT INTO assistant_message(id,thread_id,document) VALUES (?,?,CAST(? AS jsonb))",UUID.randomUUID(),demo.id(),JSON.writeValueAsString(new Message(UUID.randomUUID(),"user","User-added demo follow-up","complete","demo","demo",java.time.Instant.now(),List.of(),List.of(),null,"")));
        int catalogueCount=db.queryForObject("SELECT count(*) FROM catalogue_version",Integer.class);
        var archive=JSON.readTree(maintenance.export());
        assertThat(archive.path("format").asText()).isEqualTo("ethicspark-workspace-export-1");
        assertThat(archive.path("tables").path("assistant_project").toString()).contains(p.id().toString(),"deleted_at");
        assertThat(archive.path("tables").path("profile_attachment").toString()).contains(Base64.getEncoder().encodeToString("Attachment evidence".getBytes(java.nio.charset.StandardCharsets.UTF_8)),file.id().toString());
        assertThat(archive.path("tables").path("assistant_message").size()).isGreaterThanOrEqualTo(12);
        var reviewed=maintenance.snapshot();maintenance.reset(new WorkspaceMaintenance.ResetRequest("RESET",reviewed.snapshotToken()));
        var defaults=maintenance.snapshot().counts();
        assertThat(defaults.get("workflow_project")).isEqualTo(1);assertThat(defaults.get("assistant_project")).isEqualTo(1);
        assertThat(defaults.get("assistant_thread")).isEqualTo(1);assertThat(defaults.get("assistant_message")).isEqualTo(12);
        assertThat(defaults.get("profile_attachment")).isZero();assertThat(defaults.get("assistant_receipt")).isZero();
        assertThat(defaults.get("profile_version")).isZero();assertThat(defaults.get("plan_version")).isZero();assertThat(defaults.get("reasoning_run")).isZero();
        assertThat(assistant.projects()).hasSize(1);assertThat(assistant.trashedProjects()).isEmpty();
        assertThat(db.queryForObject("SELECT count(*) FROM catalogue_version",Integer.class)).isEqualTo(catalogueCount);
        assertThatThrownBy(()->maintenance.beginOperation(p.id())).hasMessageContaining("no longer available");
        // The original demo is restored, subsequent loads reuse it and normal history stays immutable.
        var reloaded=assistant.loadDemo();assertThat(reloaded.id()).isNotEqualTo(demo.id());assertThat(reloaded.messages()).hasSize(12);
        assertThat(assistant.loadDemo().id()).isEqualTo(reloaded.id());
        var again=maintenance.snapshot();maintenance.reset(new WorkspaceMaintenance.ResetRequest("RESET",again.snapshotToken()));
        assertThat(assistant.loadDemo().messages()).hasSize(12);assertThat(assistant.projects()).hasSize(1);
        assertThatThrownBy(()->db.update("DELETE FROM review_event WHERE project_id=?",assistant.loadDemo().projectId())).hasMessageContaining("immutable");
    }
    @Test void firstRunRestoresDemoOnceAndDoesNotReopenItAfterDeletionOrOverwriteExistingWork() {
        maintenance.reset(new WorkspaceMaintenance.ResetRequest("RESET",maintenance.snapshot().snapshotToken()));
        // Simulate a fresh database inside the isolated test instance.
        db.execute("TRUNCATE assistant_demo,assistant_receipt,assistant_message,assistant_thread,assistant_project,reasoning_run,profile_attachment,plan_version,review_event,profile_version,workflow_project,workspace_initialization");
        assistant.initializeDefaultWorkspace();var first=assistant.loadDemo();
        assertThat(first.messages()).hasSize(12);assertThat(assistant.projects()).hasSize(1);
        assistant.trashProject(first.projectId());assistant.initializeDefaultWorkspace();
        assertThat(assistant.projects()).isEmpty();assertThat(assistant.trashedProjects()).hasSize(1);
        db.update("DELETE FROM workspace_initialization WHERE name='first-run-v1'");
        var own=assistant.createProject(new CreateProject("Existing work"));assistant.initializeDefaultWorkspace();
        assertThat(assistant.projects()).extracting(Project::id).containsExactly(own.id());
        assertThat(assistant.trashedProjects()).hasSize(1);
    }

}
