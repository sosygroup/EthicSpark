package org.ethicsaware.catalogue.service;

import com.sun.net.httpserver.HttpServer;
import org.ethicsaware.catalogue.core.WorkbookImporter;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.assertj.core.api.Assertions.*;
import static org.ethicsaware.catalogue.service.Workflow.*;
import static org.ethicsaware.catalogue.service.Reasoning.*;

/** Real PostgreSQL and HTTP transport; all provider calls go to a local deterministic stub. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"catalogue.import.enabled=false"})
class AssistedWorkflowIT {
    static final JsonMapper JSON=JsonMapper.builder().build();
    static final AtomicReference<Output> OUTPUT=new AtomicReference<>();
    static final AtomicReference<String> INPUT=new AtomicReference<>("");
    static final AtomicInteger STATUS=new AtomicInteger(200),CALLS=new AtomicInteger();
    static final HttpServer STUB=start();
    static HttpServer start() {
        try {
            HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
            server.createContext("/",exchange->{
                String result;
                if(exchange.getRequestURI().getPath().endsWith("/models")) result="{\"data\":[{\"id\":\"gpt-test-model\"}]}";
                else if(exchange.getRequestURI().getPath().endsWith("/api/show")) result="{\"capabilities\":[\"completion\"]}";
                else {
                    CALLS.incrementAndGet();INPUT.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
                    String output=JSON.writeValueAsString(OUTPUT.get());
                    result=exchange.getRequestURI().getPath().endsWith("/api/chat")?
                            JSON.writeValueAsString(Map.of("done",true,"done_reason","stop","message",Map.of("content",output))):
                            exchange.getRequestURI().getPath().endsWith("/messages")?
                            JSON.writeValueAsString(Map.of("stop_reason","end_turn","content",List.of(Map.of("type","text","text",output)))):
                            JSON.writeValueAsString(Map.of("choices",List.of(Map.of("finish_reason","stop","message",Map.of("content",output)))));
                }
                byte[] bytes=result.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");
                exchange.sendResponseHeaders(STATUS.get(),bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
            });server.start();return server;
        } catch(IOException e) { throw new ExceptionInInitializerError(e); }
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        for(String provider:List.of("OPENAI","ANTHROPIC","OLLAMA")) {
            registry.add(provider+"_BASE_URL",()->"http://127.0.0.1:"+STUB.getAddress().getPort()+"/v1");
            registry.add(provider+"_API_KEY",()->"local-test-credential");
        }
    }
    @Autowired WorkflowService workflow;
    @Autowired ReasoningService reasoning;
    @Autowired AttachmentService files;
    @Autowired CatalogueStore catalogues;
    @Autowired LlmGateway gateway;
    @Autowired org.springframework.jdbc.core.JdbcTemplate db;
    @Value("${local.server.port}") int port;
    @BeforeEach void prepare() throws Exception {
        STATUS.set(200);CALLS.set(0);
        byte[] bytes=Files.readAllBytes(Path.of(System.getProperty("catalogue.test.workbook")));
        String version=catalogues.save(new WorkbookImporter().read(bytes),bytes);
        var catalogue=catalogues.catalogue(version).orElseThrow();
        List<ClusterProposal> clusters=catalogue.clusters().subList(0,2).stream().map(c->new ClusterProposal(c.id(),"Relevant to the purpose and personal data fields.",List.of(new Mapping(c.labelMappings().getFirst().card(),c.labelMappings().getFirst().characteristic())))).toList();
        List<Recommendation> recs=catalogue.clusters().subList(0,2).stream().flatMap(c->c.actions().stream()).map(a->{
            boolean suitable=a.id().endsWith("A1");
            return new Recommendation(a.id(),"The support portal processes personal tickets.","Document the support portal context: "+a.text(),a.evidence(),"Review the evidence with stakeholders.","Product team","Adapted to the purpose field.",suitable?List.of("Requirements"):List.of(),"proposed","not_started","",suitable?"suitable":"not_applicable",suitable?"This action applies while defining requirements.":"Reassess this operational activity in Operations.");
        }).toList();
        OUTPUT.set(new Output(clusters,recs,List.of("Retention is unknown.")));
    }
    List<Field> fields() {
        return FIELD_IDS.stream().map(id->new Field(id,id.equals("phase")?"Requirements":id.equals("additional")?"":"Context for "+id,"known")).toList();
    }
    Project ready() {
        Project p=workflow.create(new Create("Assisted workflow test","Reviewer"));
        return workflow.profile(p.id(),new ProfileChange(p.revision(),"Reviewer",fields(),true));
    }
    @Test void storesFileOnlyFieldsCompanyEthicsAndNoneWithoutLosingKnownSafeguards() throws Exception {
        Project p=workflow.create(new Create("Attachment test","Reviewer"));
        var purpose=files.upload(p.id(),"purpose",new MockMultipartFile("file","purpose.txt","text/plain","Support portal purpose".getBytes(StandardCharsets.UTF_8)));
        var policy=files.upload(p.id(),"company_ethics",new MockMultipartFile("file","policy.txt","text/plain","Internal policy: human oversight".getBytes(StandardCharsets.UTF_8)));
        var additional=files.upload(p.id(),"additional",new MockMultipartFile("file","architecture.bin","application/octet-stream",new byte[]{1,2,3}));
        List<Field> fs=new ArrayList<>(fields());
        fs.set(0,new Field("purpose","","known",List.of(purpose.id()),List.of()));
        fs.set(6,new Field("sharing","","none"));
        fs.set(7,new Field("safeguards","Encryption enabled","company_ethics",List.of(),List.of(policy.id())));
        fs.set(8,new Field("additional","","known",List.of(additional.id()),List.of()));
        Project confirmed=workflow.profile(p.id(),new ProfileChange(p.revision(),"Reviewer",fs,true));
        assertThat(confirmed.profile().fields().get(6).value()).isEqualTo(NO_SHARING);
        assertThat(confirmed.profile().fields().get(7).value()).isEqualTo("Encryption enabled");
        assertThat(files.get(p.id(),policy.id()).text()).contains("human oversight");
        assertThat(additional.extraction()).contains("Stored only");
        assertThat(files.bytes(p.id(),purpose.id())).isEqualTo("Support portal purpose".getBytes(StandardCharsets.UTF_8));
        Project other=ready();
        assertThatThrownBy(()->files.get(other.id(),purpose.id())).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->files.validate(p.id(),"data",List.of(purpose.id()))).isInstanceOf(ResponseStatusException.class);
        List<Field> invalid=new ArrayList<>(fs);invalid.set(7,new Field("safeguards","","company_ethics"));
        assertThatThrownBy(()->workflow.profile(p.id(),new ProfileChange(confirmed.revision(),"Reviewer",invalid,true))).isInstanceOf(ResponseStatusException.class);
        String boundary="attachment-test-boundary";
        String multipart="--"+boundary+"\r\nContent-Disposition: form-data; name=\"field\"\r\n\r\nadditional\r\n--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"workflow.md\"\r\nContent-Type: text/plain\r\n\r\nWorkflow: submit, triage, respond.\r\n--"+boundary+"--\r\n";
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/projects/"+p.id()+"/attachments")).header("Content-Type","multipart/form-data; boundary="+boundary).POST(HttpRequest.BodyPublishers.ofString(multipart)).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(201);assertThat(response.body()).contains("submit, triage, respond");
        Run run=reasoning.generate(confirmed.id(),new Request(confirmed.revision(),"Reviewer","anthropic","gpt-test-model",true));
        assertThat(INPUT.get()).contains("Support portal purpose","Internal policy: human oversight","Stored only");
        Project applied=reasoning.apply(confirmed.id(),new Apply(confirmed.revision(),"Reviewer",run.id(),run.output().clusters()));
        Project accepted=workflow.recommendation(applied.id(),"C01-A1",new RecommendationChange(applied.revision(),"Reviewer",applied.recommendations().getFirst(),"accept"));
        Plan approved=workflow.approve(accepted.id(),new Approval(accepted.revision(),"Reviewer",UUID.randomUUID()));
        assertThat(approved.attachments()).hasSize(3).anyMatch(a->a.sha256().equals(purpose.sha256()));
        assertThatThrownBy(()->db.update("UPDATE profile_attachment SET content=? WHERE id=?",new byte[]{0},purpose.id())).hasMessageContaining("immutable");
    }
    @Test void allThreeProvidersUseRealTransportAndProposalsWaitForReview() {
        for(String provider:List.of("openai","anthropic","ollama")) {
            Project p=ready();
            var image=files.upload(p.id(),"additional",new MockMultipartFile("file","diagram.png","image/png",Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a42cAAAAASUVORK5CYII=")));
            var fs=new ArrayList<>(p.profile().fields());fs.set(8,new Field("additional","","known",List.of(image.id()),List.of()));
            p=workflow.profile(p.id(),new ProfileChange(p.revision(),"Reviewer",fs,true));
            assertThat(gateway.models(provider)).containsExactly("gpt-test-model");
            Run run=reasoning.generate(p.id(),new Request(p.revision(),"Reviewer",provider,"gpt-test-model",true));
            assertThat(workflow.get(p.id())).isEqualTo(p);
            assertThat(run.output().clusters()).hasSize(2);assertThat(run.output().recommendations()).hasSize(12);
            assertThat(INPUT.get()).contains("Requirements","Company ethics documents","untrusted evidence");
            assertThat(INPUT.get()).contains(provider.equals("anthropic")?"\"media_type\":\"image/png\"":provider.equals("ollama")?"\"images\":[":"data:image/png;base64,");
            Project applied=reasoning.apply(p.id(),new Apply(p.revision(),"Reviewer",run.id(),run.output().clusters()));
            assertThat(applied.selectedClusters()).containsExactly("C-01","C-02");
            assertThat(applied.recommendations()).hasSize(12).allMatch(r->r.reviewStatus().equals("proposed"));
            assertThat(workflow.approvalPreview(applied.id()).entries()).isEmpty();
            Recommendation notApplicable=applied.recommendations().get(1);
            assertThatThrownBy(()->workflow.recommendation(applied.id(),notApplicable.sourceActionId(),new RecommendationChange(applied.revision(),"Reviewer",notApplicable,"accept"))).isInstanceOf(ResponseStatusException.class);
            var accepted=workflow.recommendation(applied.id(),"C02-A1",new RecommendationChange(applied.revision(),"Reviewer",applied.recommendations().get(6),"accept"));
            Plan plan=workflow.approve(accepted.id(),new Approval(accepted.revision(),"Reviewer",UUID.randomUUID()));
            assertThat(plan.entries()).hasSize(1);assertThat(plan.entries().getFirst().source().id()).isEqualTo("C02-A1");
            assertThat(plan.origin()).contains(provider);assertThat(plan.reasoning().id()).isEqualTo(run.id());
        }
    }
    @Test void invalidModelOutputMissingConsentStaleRunsAndCrossProjectRunsNeverChangeSelection() {
        Project p=ready();
        assertThatThrownBy(()->reasoning.generate(p.id(),new Request(p.revision(),"Reviewer","openai","gpt-test-model",false))).isInstanceOf(ResponseStatusException.class);
        assertThat(CALLS.get()).isZero();
        Output valid=OUTPUT.get();OUTPUT.set(new Output(valid.clusters(),valid.recommendations().subList(0,1),List.of()));
        assertThatThrownBy(()->reasoning.generate(p.id(),new Request(p.revision(),"Reviewer","openai","gpt-test-model",true))).isInstanceOf(ResponseStatusException.class);
        assertThat(workflow.get(p.id())).isEqualTo(p);
        OUTPUT.set(valid);Run run=reasoning.generate(p.id(),new Request(p.revision(),"Reviewer","openai","gpt-test-model",true));
        Project other=ready();
        assertThatThrownBy(()->reasoning.get(other.id(),run.id())).isInstanceOf(ResponseStatusException.class);
        Project changed=workflow.selection(p.id(),new SelectionChange(p.revision(),"Reviewer",List.of("C-03")));
        assertThatThrownBy(()->reasoning.apply(p.id(),new Apply(changed.revision(),"Reviewer",run.id(),run.output().clusters()))).isInstanceOf(ResponseStatusException.class);
        assertThat(workflow.get(p.id()).selectedClusters()).containsExactly("C-03");
        STATUS.set(429);
        assertThatThrownBy(()->reasoning.generate(other.id(),new Request(other.revision(),"Reviewer","openai","gpt-test-model",true))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("HTTP 429");
    }
    @Test void rejectsInventedMappingsDuplicateActionsAndWrongPhaseSuitability() throws Exception {
        var catalogue=catalogues.catalogue(ready().catalogueVersion()).orElseThrow();Output valid=OUTPUT.get();
        var badCluster=new ClusterProposal("C-01","Relevant",List.of(new Mapping("Invented card","Invented characteristic")));
        assertThatThrownBy(()->ReasoningService.validate(new Output(List.of(badCluster),valid.recommendations(),List.of()),catalogue,List.of("Requirements"))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->ReasoningService.validate(valid,catalogue,List.of("Operations"))).isInstanceOf(IllegalArgumentException.class);
        var recs=new ArrayList<>(valid.recommendations());recs.set(1,recs.getFirst());
        assertThatThrownBy(()->ReasoningService.validate(new Output(valid.clusters(),recs,List.of()),catalogue,List.of("Requirements"))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void extractsPdfAndDocxAndDisclosesUnreadableOrTruncatedMaterial() throws Exception {
        Project p=ready();byte[] pdfBytes,docBytes;
        try(var pdf=new org.apache.pdfbox.pdmodel.PDDocument();var out=new ByteArrayOutputStream()) {
            var page=new org.apache.pdfbox.pdmodel.PDPage();pdf.addPage(page);
            try(var stream=new org.apache.pdfbox.pdmodel.PDPageContentStream(pdf,page)) {
                stream.beginText();stream.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA),12);stream.newLineAtOffset(20,700);stream.showText("Requirements for support tickets");stream.endText();
            }
            pdf.save(out);pdfBytes=out.toByteArray();
        }
        try(var doc=new org.apache.poi.xwpf.usermodel.XWPFDocument();var out=new ByteArrayOutputStream()) {
            doc.createParagraph().createRun().setText("Internal rules for human oversight");doc.write(out);docBytes=out.toByteArray();
        }
        assertThat(files.upload(p.id(),"purpose",new MockMultipartFile("file","requirements.pdf","application/pdf",pdfBytes)).text()).contains("support tickets");
        assertThat(files.upload(p.id(),"company_ethics",new MockMultipartFile("file","rules.docx","application/octet-stream",docBytes)).text()).contains("human oversight");
        try(var workbook=new org.apache.poi.xssf.usermodel.XSSFWorkbook();var out=new ByteArrayOutputStream()) {
            var row=workbook.createSheet("Requirements").createRow(0);row.createCell(0).setCellValue("Human review");row.createCell(1).setCellFormula("1+1");workbook.write(out);
            assertThat(files.upload(p.id(),"additional",new MockMultipartFile("file","requirements.xlsx","application/octet-stream",out.toByteArray())).text()).contains("Human review","Formula (not recalculated): 1+1");
        }
        try(var presentation=new org.apache.poi.xslf.usermodel.XMLSlideShow();var out=new ByteArrayOutputStream()) {
            presentation.createSlide().createTextBox().setText("Human oversight architecture");presentation.write(out);
            assertThat(files.upload(p.id(),"additional",new MockMultipartFile("file","design.pptx","application/octet-stream",out.toByteArray())).text()).contains("Human oversight architecture");
        }
        var truncated=files.upload(p.id(),"additional",new MockMultipartFile("file","long.md","text/plain","x".repeat(50001).getBytes(StandardCharsets.UTF_8)));
        assertThat(truncated.text()).hasSize(50000);assertThat(truncated.extraction()).contains("truncated");
        assertThatThrownBy(()->files.upload(p.id(),"additional",new MockMultipartFile("file","fake.pdf","application/pdf",new byte[]{1,2}))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->files.upload(p.id(),"additional",new MockMultipartFile("file","fake.png","image/png",new byte[]{1,2}))).isInstanceOf(ResponseStatusException.class);
    }
}
