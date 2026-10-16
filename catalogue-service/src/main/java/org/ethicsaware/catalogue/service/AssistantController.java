package org.ethicsaware.catalogue.service;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static org.ethicsaware.catalogue.service.Assistant.*;
import org.ethicsaware.catalogue.service.Assistant.Thread;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {
    private final AssistantService service;
    public AssistantController(AssistantService service) {this.service=service;}
    @GetMapping("/projects") public List<Project> projects() {return service.projects();}
    @PostMapping("/projects") public Project create(@RequestBody CreateProject request) {return service.createProject(request);}
    @GetMapping("/projects/trash") public List<Project> trash() {return service.trashedProjects();}
    @PostMapping("/projects/{id}/rename") public Project rename(@PathVariable UUID id,@RequestBody CreateProject request) {return service.renameProject(id,request);}
    @PostMapping("/projects/{id}/trash") public Map<String,Boolean> trash(@PathVariable UUID id) {service.trashProject(id);return Map.of("deleted",true);}
    @PostMapping("/projects/{id}/restore") public Project restore(@PathVariable UUID id) {return service.restoreProject(id);}
    @GetMapping("/threads") public List<ThreadSummary> threads() {return service.threads();}
    @PostMapping("/threads") public Thread createThread(@RequestBody CreateThread request) {return service.createThread(request);}
    @GetMapping("/threads/{id}") public Thread thread(@PathVariable UUID id) {return service.thread(id);}
    @PostMapping("/threads/{id}/messages") public Thread send(@PathVariable UUID id,@RequestBody Send request) {return service.send(id,request);}
    @PostMapping("/threads/{id}/stop") public Thread stop(@PathVariable UUID id) {return service.cancel(id);}
    @PostMapping("/threads/{id}/messages/{message}/receipts") public Thread receipt(@PathVariable UUID id,@PathVariable UUID message,@RequestBody Execution request) {return service.receipt(id,message,request);}
    @GetMapping("/threads/{id}/export") public ResponseEntity<String> export(@PathVariable UUID id) {
        var t=service.thread(id);StringBuilder text=new StringBuilder("# "+t.title()+"\n\n");
        for(var m:t.messages()) {text.append("## ").append(m.role()).append(" · ").append(m.at()).append("\n\n").append(m.text()).append("\n\n");if(m.output()!=null) for(var c:m.output().citations()) text.append("Catalogue: ").append(c.clusterId()).append(" ").append(c.actionIds()).append(" — ").append(c.rationale()).append("\n\n");}
        for(var r:t.receipts()) text.append("Operation ").append(r.operationId()).append(": ").append(r.status()).append("\n\n").append(r.summary()).append("\n\n```text\n").append(r.output()).append("\n```\n\n");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/markdown;charset=UTF-8")).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=conversation-"+id+".md").body(text.toString());
    }
}
