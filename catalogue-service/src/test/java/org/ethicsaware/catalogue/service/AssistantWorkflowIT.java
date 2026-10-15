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
    @Autowired org.springframework.jdbc.core.JdbcTemplate db;
    @BeforeEach void prepare() throws Exception {
        byte[] source=Files.readAllBytes(Path.of(System.getProperty("catalogue.test.workbook")));catalogues.save(new WorkbookImporter().read(source),source);
        RESPONSE.set(new Output("Here is a practical answer.\n\n```java\nclass Example {}\n```",List.of(),List.of(),List.of(),List.of(new Artifact("notes.md","text/markdown","# Notes\nA useful document."))));CALLS.set(0);started=null;release=null;
    }
    Thread conversation() {var p=service.createProject(new CreateProject("Conversation test"));return service.createThread(new CreateThread(p.id()));}
    Send request(Thread t,String text,Workspace workspace,boolean continuation) {return new Send(t.revision(),UUID.randomUUID(),text,"openai","gpt-test-model",true,List.of(),workspace,continuation);}
    @Test void startsFromOnePromptWithoutProfileOrClusterSelectionAndPersistsRichOutput() {
        Thread t=conversation();var sent=service.send(t.id(),request(t,"Help me design a Java API.",null,false));
        assertThat(sent.messages()).hasSize(2);assertThat(sent.messages().getLast().status()).isEqualTo("complete");assertThat(sent.messages().getLast().output().artifacts().getFirst().name()).isEqualTo("notes.md");
        assertThat(sent.messages().getLast().inputSha256()).hasSize(64);assertThat(service.thread(t.id())).isEqualTo(sent);
        assertThat(db.queryForObject("SELECT count(*) FROM profile_version WHERE project_id=?",Integer.class,t.projectId())).isZero();
        assertThat(INPUT.get()).contains("Do NOT ask the user to complete a profile","general software development assistant","C-24","184").doesNotContain("OPENAI_API_KEY");
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
        assertThat(service.send(t.id(),request(result,"Try again.",null,false)).messages().getLast().status()).isEqualTo("error");
    }
    @Test void cancelledResponsesCannotOverwriteCancellationWhenProviderFinishesLater() throws Exception {
        Thread t=conversation();started=new CountDownLatch(1);release=new CountDownLatch(1);
        try(var executor=Executors.newSingleThreadExecutor()) {
            var future=executor.submit(()->service.send(t.id(),request(t,"Take your time.",null,false)));
            assertThat(started.await(5,TimeUnit.SECONDS)).isTrue();Thread stopped=service.cancel(t.id());assertThat(stopped.messages().getLast().status()).isEqualTo("cancelled");release.countDown();assertThat(future.get(5,TimeUnit.SECONDS).messages().getLast().status()).isEqualTo("cancelled");
        }finally{release.countDown();started=null;release=null;}
    }
    @Test void contextTraversalAndAnUnreadExistingFileFingerprintAreRejected() {
        Thread t=conversation();assertThatThrownBy(()->service.send(t.id(),request(t,"Read secrets",new Workspace("Project",List.of(".env"),List.of()),false))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        var source=catalogues.catalogue(service.project(t.projectId()).catalogueVersion()).orElseThrow();
        var edit=new Output("Edit",List.of(),List.of(),List.of(new Operation("","write","app.java","new","a".repeat(64),"",List.of(),"Change this file")),List.of());
        assertThatThrownBy(()->AssistantService.validateOutput(edit,source,new Workspace("Project",List.of(),List.of()))).isInstanceOf(IllegalArgumentException.class);
    }
}
