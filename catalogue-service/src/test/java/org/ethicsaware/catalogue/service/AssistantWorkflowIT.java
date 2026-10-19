package org.ethicsaware.catalogue.service;

import com.sun.net.httpserver.HttpServer;
import org.ethicsaware.catalogue.core.WorkbookImporter;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.assertj.core.api.Assertions.*;
import static org.ethicsaware.catalogue.service.Assistant.*;
import org.ethicsaware.catalogue.service.Assistant.Thread;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"catalogue.import.enabled=false"})
class AssistantWorkflowIT {
    static final JsonMapper JSON=JsonMapper.builder().build();
    static final AtomicReference<Output> RESPONSE=new AtomicReference<>();
    static final AtomicReference<String> INPUT=new AtomicReference<>("");
    static final AtomicInteger CALLS=new AtomicInteger();
    static volatile CountDownLatch started,release;
    static final HttpServer STUB=server();
    static HttpServer server() {
        try {var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/v1/chat/completions",exchange->{
            CALLS.incrementAndGet();INPUT.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            if(started!=null)started.countDown();if(release!=null)try{release.await(10,TimeUnit.SECONDS);}catch(InterruptedException e){java.lang.Thread.currentThread().interrupt();}
            byte[] bytes=JSON.writeValueAsString(Map.of("choices",List.of(Map.of("finish_reason","stop","message",Map.of("content",JSON.writeValueAsString(RESPONSE.get())))))).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });server.start();return server;}catch(Exception e){throw new ExceptionInInitializerError(e);}
    }
    @DynamicPropertySource static void config(DynamicPropertyRegistry properties) {
        properties.add("OPENAI_BASE_URL",()->"http://127.0.0.1:"+STUB.getAddress().getPort()+"/v1");properties.add("OPENAI_API_KEY",()->"local-test-credential");
    }
    @Autowired AssistantService service;
    @Autowired CatalogueStore catalogues;
    @Autowired WorkflowService workflow;
    @Autowired AttachmentService attachments;
    @Autowired org.springframework.jdbc.core.JdbcTemplate db;
    @BeforeEach void prepare() throws Exception {
        byte[] source=Files.readAllBytes(Path.of(System.getProperty("catalogue.test.workbook")));catalogues.save(new WorkbookImporter().read(source),source);
        RESPONSE.set(new Output("Here is a practical answer.\n\n```java\nclass Example {}\n```",List.of(),List.of(),List.of(),List.of(new Artifact("notes.md","text/markdown","# Notes\nA useful document."))));CALLS.set(0);started=null;release=null;
    }
    Thread conversation() {var p=service.createProject(new CreateProject("Conversation test"));return service.createThread(new CreateThread(p.id()));}
    Send request(Thread t,String text,Workspace workspace,boolean continuation) {return new Send(t.revision(),UUID.randomUUID(),text,"openai","gpt-test-model",true,List.of(),workspace,continuation);}
    @Test void compactModelCatalogueKeepsEverySourceActionAndItsMeaningfulFields() {
        var source=catalogues.catalogue(catalogues.versions().getFirst().id()).orElseThrow();
        var compact=AssistantService.modelCatalogue(source);String encoded=JSON.writeValueAsString(compact);
        var tree=JSON.readTree(encoded);assertThat(tree.size()).isEqualTo(24);
        for(int i=0;i<source.clusters().size();i++) {
            var cluster=source.clusters().get(i);var item=tree.get(i);
            assertThat(item.path("id").asText()).isEqualTo(cluster.id());assertThat(item.path("definition").asText()).isEqualTo(cluster.definition());
            assertThat(item.path("labelMappings").size()).isEqualTo(cluster.labelMappings().size());
            assertThat(item.path("actions").size()).isEqualTo(6);
            for(int j=0;j<6;j++) {var expected=cluster.actions().get(j);var actual=item.path("actions").get(j);
                assertThat(actual.path("id").asText()).isEqualTo(expected.id());assertThat(actual.path("text").asText()).isEqualTo(expected.text());assertThat(actual.path("evidence").asText()).isEqualTo(expected.evidence());
                assertThat(actual.path("phases").toString()).isEqualTo(JSON.writeValueAsString(expected.phases()));assertThat(actual.path("roles").toString()).isEqualTo(JSON.writeValueAsString(expected.roles()));
            }
        }
        assertThat(encoded).doesNotContain("\"expertObservations\"","\"source\"");
        assertThat(encoded.length()).isLessThan((int)(JSON.writeValueAsString(Map.of("clusters",source.clusters(),"references",source.references())).length()*0.65));
    }
    @Test void demoIsOfflineIdempotentRestorableAndPreservesLaterConversations() {
        var demo=service.loadDemo();
        assertThat(demo.messages()).hasSize(12);
        assertThat(demo.messages().getFirst().text()).contains("requirements");
        assertThat(demo.messages().getLast().text()).contains("Operations");
        assertThat(demo.messages()).allMatch(m->m.status().equals("complete")&&m.attachmentIds().isEmpty());
        assertThat(demo.messages().stream().filter(m->m.output()!=null).flatMap(m->m.output().operations().stream())).isEmpty();
        assertThat(demo.messages().stream().filter(m->m.output()!=null).flatMap(m->m.output().artifacts().stream()).map(Artifact::mediaType)).contains("image/svg+xml","text/vnd.mermaid","text/csv");
        var source=catalogues.catalogue(service.project(demo.projectId()).catalogueVersion()).orElseThrow();
        var actionIds=source.clusters().stream().flatMap(c->c.actions().stream()).map(a->a.id()).toList();
        var cited=demo.messages().stream().filter(m->m.output()!=null).flatMap(m->m.output().citations().stream()).flatMap(c->c.actionIds().stream()).toList();
        assertThat(cited).isNotEmpty().allMatch(actionIds::contains);
        assertThat(demo.receipts()).isEmpty();
        assertThat(CALLS.get()).isZero();
        var extra=service.createThread(new CreateThread(demo.projectId()));
        assertThat(service.loadDemo().id()).isEqualTo(demo.id());
        service.trashProject(demo.projectId());
        assertThat(service.projects()).noneMatch(p->p.id().equals(demo.projectId()));
        assertThat(service.loadDemo()).isEqualTo(demo);
        assertThat(service.thread(extra.id()).projectId()).isEqualTo(demo.projectId());
        assertThat(service.projects().stream().filter(p->p.id().equals(demo.projectId()))).hasSize(1);
        assertThat(CALLS.get()).isZero();
    }
    @Test void renamesAProjectWithoutChangingConversationIdentityOrCatalogue() {
        Thread t=conversation();var original=service.project(t.projectId());
        var renamed=service.renameProject(t.projectId(),new CreateProject("  Renamed workspace  "));
        assertThat(renamed.name()).isEqualTo("Renamed workspace");assertThat(renamed.id()).isEqualTo(original.id());assertThat(renamed.catalogueVersion()).isEqualTo(original.catalogueVersion());
        assertThat(service.thread(t.id()).projectId()).isEqualTo(renamed.id());assertThat(workflow.get(renamed.id()).name()).isEqualTo(renamed.name());
        assertThat(workflow.list().stream().filter(p->p.id().equals(renamed.id())).findFirst().orElseThrow().name()).isEqualTo(renamed.name());
        assertThatThrownBy(()->service.renameProject(renamed.id(),new CreateProject("  "))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->service.renameProject(renamed.id(),new CreateProject("a".repeat(161)))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(service.project(renamed.id()).name()).isEqualTo("Renamed workspace");
    }
    @Test void trashHidesTheProjectAndRestorePreservesMessagesAttachmentsAndImmutableReceipts() {
        Thread t=conversation();UUID project=t.projectId();
        var attachment=attachments.upload(project,"additional",new org.springframework.mock.web.MockMultipartFile("file","notes.txt","text/plain","Saved material".getBytes(StandardCharsets.UTF_8)));
        RESPONSE.set(new Output("A proposed command",List.of(),List.of(),List.of(new Operation("","command","","","","echo",List.of("hello"),"Example command")),List.of()));
        var sent=service.send(t.id(),request(t,"Propose a command",null,false));var message=sent.messages().getLast();
        var saved=service.receipt(t.id(),message.id(),new Execution(message.output().operations().getFirst().id(),"rejected","Not needed","",null));
        service.trashProject(project);
        assertThat(service.projects()).noneMatch(p->p.id().equals(project));assertThat(service.threads()).noneMatch(v->v.projectId().equals(project));assertThat(workflow.list()).noneMatch(p->p.id().equals(project));
        assertThat(service.trashedProjects()).anyMatch(p->p.id().equals(project));
        assertThatThrownBy(()->service.thread(t.id())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->service.createThread(new CreateThread(project))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->service.renameProject(project,new CreateProject("Hidden"))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->attachments.get(project,attachment.id())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->workflow.get(project)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        service.restoreProject(project);
        assertThat(service.thread(t.id())).isEqualTo(saved);assertThat(attachments.get(project,attachment.id()).text()).isEqualTo("Saved material");
        assertThat(service.trashedProjects()).noneMatch(p->p.id().equals(project));assertThat(workflow.get(project).id()).isEqualTo(project);
        assertThatThrownBy(()->service.restoreProject(project)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->db.update("DELETE FROM assistant_receipt WHERE id=?",saved.receipts().getFirst().id())).hasMessageContaining("immutable");
    }
    @Test void startsFromOnePromptWithoutProfileOrClusterSelectionAndPersistsRichOutput() {
        Thread t=conversation();var sent=service.send(t.id(),request(t,"Help me design a Java API.",null,false));
        assertThat(sent.messages()).hasSize(2);assertThat(sent.messages().getLast().status()).isEqualTo("complete");assertThat(sent.messages().getLast().output().artifacts().getFirst().name()).isEqualTo("notes.md");
        assertThat(sent.messages().getLast().metrics().contextPreparationSeconds()).isGreaterThanOrEqualTo(0);assertThat(sent.messages().getLast().metrics().requestSeconds()).isGreaterThanOrEqualTo(0);assertThat(sent.messages().getLast().metrics().loadSeconds()).isNull();
        assertThat(sent.messages().getLast().inputSha256()).hasSize(64);assertThat(service.thread(t.id())).isEqualTo(sent);
        assertThat(db.queryForObject("SELECT count(*) FROM profile_version WHERE project_id=?",Integer.class,t.projectId())).isZero();
        assertThat(INPUT.get()).contains("Do NOT ask the user to complete a profile","general software development assistant","C-24","184").doesNotContain("OPENAI_API_KEY");
        var input=JSON.readTree(INPUT.get());String context=input.path("messages").get(1).path("content").get(0).path("text").asText();
        assertThat(context).startsWith("{\"catalogue\":");var material=JSON.readTree(context);assertThat(material.path("referenceRegistry").path("count").asInt()).isEqualTo(184);assertThat(material.path("referenceRegistry").path("ids").size()).isEqualTo(184);
    }
    @Test void fileReadsAndEditsAreProposalsUntilASeparateNativeReceiptIsRecorded() {
        Thread t=conversation();RESPONSE.set(new Output("I need the current file before changing it.",List.of(),List.of("src/App.java"),List.of(),List.of()));
        Thread first=service.send(t.id(),request(t,"Improve this class.",new Workspace("Project",List.of("src/App.java"),List.of()),false));
        String source="class App {}",sha=WorkbookImporter.sha256(source.getBytes(StandardCharsets.UTF_8));
        var edit=new Operation("model-id","write","src/App.java","class App { int value; }",sha,"",List.of(),"Add a field to the class.");
        RESPONSE.set(new Output("Here is the proposed change. It has not been applied.",List.of(new Citation("C-01",List.of("C01-A1"),"Consider personal-data handling when extending the API.")),List.of(),List.of(edit),List.of()));
        Thread next=service.send(t.id(),request(first,"Continue with file context.",new Workspace("Project",List.of("src/App.java"),List.of(new FileContext("src/App.java",sha,source,""))),true));
        var message=next.messages().getLast();var proposed=message.output().operations().getFirst();assertThat(proposed.id()).isNotEqualTo("model-id");assertThat(next.receipts()).isEmpty();
        Thread denied=service.receipt(t.id(),message.id(),new Execution(proposed.id(),"rejected","Developer declined.","",null));assertThat(denied.receipts().getFirst().status()).isEqualTo("rejected");
        Thread other=conversation();assertThatThrownBy(()->service.receipt(other.id(),message.id(),new Execution(proposed.id(),"applied","Wrong project","",null))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->db.update("DELETE FROM assistant_receipt WHERE id=?",UUID.fromString(denied.receipts().getFirst().id().toString()))).hasMessageContaining("immutable");
    }
    @Test void duplicateRequestsDoNotDuplicateProviderCallsAndChangedInputCannotReuseAKey() {
        Thread t=conversation();Send r=request(t,"Explain unit testing.",null,false);Thread first=service.send(t.id(),r);assertThat(service.send(t.id(),r)).isEqualTo(first);assertThat(CALLS.get()).isEqualTo(1);
        assertThatThrownBy(()->service.send(t.id(),new Send(r.revision(),r.requestKey(),"Different request",r.provider(),r.model(),true,List.of(),null,false))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("different input");
    }
    @Test void invalidModelOperationsAndInventedCitationsFailWithoutExecutingAnything() {
        Thread t=conversation();RESPONSE.set(new Output("Proposed operation",List.of(),List.of(),List.of(new Operation("","write","../outside.txt","unsafe","","",List.of(),"Try an unsafe path")),List.of()));
        Thread result=service.send(t.id(),request(t,"Make a change.",null,false));assertThat(result.messages().getLast().status()).isEqualTo("error");assertThat(result.messages().getLast().output()).isNull();assertThat(result.receipts()).isEmpty();assertThat(result.messages().getFirst().text()).isEqualTo("Make a change.");
        RESPONSE.set(new Output("Unsupported citation",List.of(new Citation("C-99",List.of(),"Invented")),List.of(),List.of(),List.of()));
        Thread failed=service.send(t.id(),request(result,"Try again.",null,false));assertThat(failed.messages().getLast().status()).isEqualTo("error");
        RESPONSE.set(new Output("Retried using the saved request.",List.of(),List.of(),List.of(),List.of()));
        assertThat(service.send(t.id(),request(failed,"Retry with saved context.",null,true)).messages().getLast().status()).isEqualTo("complete");
    }
    @Test void cancelledResponsesCannotOverwriteCancellationWhenProviderFinishesLater() throws Exception {
        Thread t=conversation();started=new CountDownLatch(1);release=new CountDownLatch(1);
        try(var executor=Executors.newSingleThreadExecutor()) {
            var future=executor.submit(()->service.send(t.id(),request(t,"Take your time.",null,false)));
            assertThat(started.await(5,TimeUnit.SECONDS)).isTrue();assertThatThrownBy(()->service.trashProject(t.projectId())).hasMessageContaining("running response");Thread stopped=service.cancel(t.id());assertThat(stopped.messages().getLast().status()).isEqualTo("cancelled");release.countDown();assertThat(future.get(5,TimeUnit.SECONDS).messages().getLast().status()).isEqualTo("cancelled");
        }finally{release.countDown();started=null;release=null;}
    }
    @Test void contextTraversalAndAnUnreadExistingFileFingerprintAreRejected() {
        Thread t=conversation();assertThatThrownBy(()->service.send(t.id(),request(t,"Read secrets",new Workspace("Project",List.of(".env"),List.of()),false))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        var source=catalogues.catalogue(service.project(t.projectId()).catalogueVersion()).orElseThrow();
        var edit=new Output("Edit",List.of(),List.of(),List.of(new Operation("","write","app.java","new","a".repeat(64),"",List.of(),"Change this file")),List.of());
        assertThatThrownBy(()->AssistantService.validateOutput(edit,source,new Workspace("Project",List.of(),List.of()))).isInstanceOf(IllegalArgumentException.class);
    }
}
