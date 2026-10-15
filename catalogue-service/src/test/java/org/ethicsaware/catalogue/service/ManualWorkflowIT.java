package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.WorkbookImporter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.*;
import java.net.*;
import java.net.http.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.ethicsaware.catalogue.service.Workflow.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"catalogue.import.enabled=false"})
class ManualWorkflowIT {
    @Autowired WorkflowService service;
    @Autowired CatalogueStore catalogues;
    @Autowired JdbcTemplate db;
    @Value("${local.server.port}") int port;
    private final JsonMapper json=JsonMapper.builder().build();
    @BeforeEach void importCatalogue() throws Exception {
        byte[] source=Files.readAllBytes(Path.of(System.getProperty("catalogue.test.workbook")));
        catalogues.save(new WorkbookImporter().read(source),source);
    }
    private List<Field> fields(){return FIELD_IDS.stream().map(id -> new Field(id,id.equals("retention")||id.equals("sharing")?"":"Confirmed context for "+id,id.equals("retention")||id.equals("sharing")?"unknown":"known")).toList();}
    private Project ready(){
        Project p=service.create(new Create("Manual workflow test","Test reviewer"));
        p=service.profile(p.id(),new ProfileChange(p.revision(),"Test reviewer",fields(),true));
        return service.selection(p.id(),new SelectionChange(p.revision(),"Test reviewer",List.of("C-01")));
    }
    private Recommendation adaptation(Recommendation r){return new Recommendation(r.sourceActionId(),"Support tickets may contain personal information.","<script>alert('escaped')</script> Inventory ticket data and document retention and sharing decisions.","Versioned ticket-data inventory","Reviewer checks the inventory against data flows.","Support engineering","Based on confirmed ticket-data context.",r.phases(),"validated","validated","");}
    @Test void manualReviewApprovalExportAndReassessmentKeepSnapshotsImmutable() throws Exception {
        Project p=ready();
        p=service.recommendation(p.id(),"C01-A1",new RecommendationChange(p.revision(),"Test reviewer",adaptation(p.recommendations().getFirst()),"save"));
        assertThat(p.recommendations().getFirst().reviewStatus()).isEqualTo("proposed");
        assertThat(p.recommendations().getFirst().implementationStatus()).isEqualTo("not_started");
        p=service.recommendation(p.id(),"C01-A1",new RecommendationChange(p.revision(),"Test reviewer",p.recommendations().getFirst(),"accept"));
        assertThat(p.recommendations().getFirst().reviewStatus()).isEqualTo("edited");
        Recommendation second=p.recommendations().get(1);
        second=new Recommendation(second.sourceActionId(),"",second.action(),second.evidence(),"","","",second.phases(),"","","Need more information about existing controls.");
        p=service.recommendation(p.id(),second.sourceActionId(),new RecommendationChange(p.revision(),"Test reviewer",second,"awaiting_information"));
        Plan preview=service.approvalPreview(p.id());
        assertThat(preview.entries()).hasSize(1);
        assertThat(preview.excludedActionIds()).contains("C01-A2");
        Approval request=new Approval(p.revision(),"Test reviewer",UUID.randomUUID());
        Plan approved=service.approve(p.id(),request);
        assertThat(approved.entries()).isEqualTo(preview.entries());
        assertThat(approved.gaps()).isEqualTo(preview.gaps());
        assertThat(approved.entries()).hasSize(1);
        assertThat(approved.excludedActionIds()).containsExactly("C01-A2","C01-A3","C01-A4","C01-A5","C01-A6");
        assertThat(approved.gaps()).anyMatch(g->g.contains("retention")).anyMatch(g->g.contains("awaiting_information"));
        assertThat(service.approve(p.id(),request)).isEqualTo(approved);
        assertThat(service.plans(p.id())).hasSize(1);
        assertThatThrownBy(()->service.approve(approved.projectId(),new Approval(request.revision()+1,request.actor(),request.requestKey()))).isInstanceOf(ResponseStatusException.class);
        String prefix="http://localhost:"+port+"/api/projects/"+p.id()+"/export?plan="+approved.id();
        var client=HttpClient.newHttpClient();
        var jsonExport=client.send(HttpRequest.newBuilder(URI.create(prefix+"&format=json")).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(jsonExport.statusCode()).isEqualTo(200);
        assertThat(json.readValue(jsonExport.body(),Plan.class)).isEqualTo(approved);
        String report=client.send(HttpRequest.newBuilder(URI.create(prefix+"&format=html")).GET().build(),HttpResponse.BodyHandlers.ofString()).body();
        assertThat(report).contains("APPROVED","C01-A1","retention","&lt;script&gt;").doesNotContain("<script>");
        p=service.get(p.id());
        List<Field> changed=new ArrayList<>(p.profile().fields()); changed.set(6,new Field("sharing","External ticket processor","known"));
        p=service.profile(p.id(),new ProfileChange(p.revision(),"Test reviewer",changed,false));
        assertThat(p.profile().confirmed()).isFalse();
        assertThat(p.recommendations()).allMatch(r->r.reviewStatus().equals("proposed"));
        assertThat(service.plan(p.id(),approved.id())).isEqualTo(approved);
        Project draft=p;
        assertThatThrownBy(()->service.approve(draft.id(),new Approval(draft.revision(),"Test reviewer",UUID.randomUUID()))).isInstanceOf(ResponseStatusException.class);
        p=service.profile(p.id(),new ProfileChange(p.revision(),"Test reviewer",changed,true));
        assertThat(p.profile().version()).isEqualTo(2);
        assertThat(db.queryForObject("SELECT count(*) FROM profile_version WHERE project_id=?",Integer.class,p.id())).isEqualTo(2);
        assertThat(service.history(p.id())).anyMatch(e->e.operation().equals("recommendation_accept")&&e.before()!=null&&e.after()!=null);
        assertThatThrownBy(()->db.update("DELETE FROM plan_version WHERE id=?",approved.id())).hasMessageContaining("immutable");
    }
    @Test void blocksIncompleteProfilesStaleEditsAndInvalidReviewTransitions() {
        Project p=service.create(new Create("Validation test","Reviewer"));
        assertThatThrownBy(()->service.profile(p.id(),new ProfileChange(p.revision(),"Reviewer",p.profile().fields(),true))).isInstanceOf(ResponseStatusException.class);
        Project ready=ready();
        assertThatThrownBy(()->service.selection(ready.id(),new SelectionChange(ready.revision()-1,"Reviewer",List.of("C-01")))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->service.selection(ready.id(),new SelectionChange(ready.revision(),"Reviewer",List.of("C-02")))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->service.recommendation(ready.id(),"C01-A1",new RecommendationChange(ready.revision(),"Reviewer",ready.recommendations().getFirst(),"reject"))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->service.approve(ready.id(),new Approval(ready.revision(),"Reviewer",UUID.randomUUID()))).isInstanceOf(ResponseStatusException.class);
    }
    @Test void supportsProjectApiAndRejectsCrossProjectPlanAccess() throws Exception {
        var client=HttpClient.newHttpClient();
        var response=client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/projects")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"API project\",\"actor\":\"Reviewer\"}")).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(201);
        Project created=json.readValue(response.body(),Project.class);
        assertThat(service.get(created.id()).catalogueVersion()).isNotBlank();
        Project other=ready();
        other=service.recommendation(other.id(),"C01-A1",new RecommendationChange(other.revision(),"Reviewer",adaptation(other.recommendations().getFirst()),"accept"));
        Plan otherPlan=service.approve(other.id(),new Approval(other.revision(),"Reviewer",UUID.randomUUID()));
        assertThat(client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/projects/"+created.id()+"/plans/"+otherPlan.id())).GET().build(),HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(404);
    }
}
