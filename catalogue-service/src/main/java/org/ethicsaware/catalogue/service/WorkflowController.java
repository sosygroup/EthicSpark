package org.ethicsaware.catalogue.service;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.util.*;
import static org.ethicsaware.catalogue.service.Workflow.*;

@RestController
@RequestMapping("/api/projects")
public class WorkflowController {
    private final WorkflowService service;
    public WorkflowController(WorkflowService service) { this.service=service; }
    @GetMapping public List<Summary> list() { return service.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public Project create(@RequestBody Create r) { return service.create(r); }
    @GetMapping("/{id}") public Project get(@PathVariable UUID id) { return service.get(id); }
    @PutMapping("/{id}/profile") public Project profile(@PathVariable UUID id,@RequestBody ProfileChange r) { return service.profile(id,r); }
    @PutMapping("/{id}/selection") public Project selection(@PathVariable UUID id,@RequestBody SelectionChange r) { return service.selection(id,r); }
    @PutMapping("/{id}/recommendations/{action}") public Project recommendation(@PathVariable UUID id,@PathVariable String action,@RequestBody RecommendationChange r) { return service.recommendation(id,action,r); }
    @GetMapping("/{id}/history") public List<Event> history(@PathVariable UUID id) { return service.history(id); }
    @GetMapping("/{id}/plans") public List<PlanSummary> plans(@PathVariable UUID id) { return service.plans(id); }
    @GetMapping("/{id}/plans/{plan}") public Plan plan(@PathVariable UUID id,@PathVariable UUID plan) { return service.plan(id,plan); }
    @PostMapping("/{id}/plans") public Plan approve(@PathVariable UUID id,@RequestBody Approval r) { return service.approve(id,r); }
    @GetMapping("/{id}/draft") public Plan draft(@PathVariable UUID id) { return service.draft(id); }
    @GetMapping("/{id}/approval-preview") public Plan approvalPreview(@PathVariable UUID id) { return service.approvalPreview(id); }
    @GetMapping("/{id}/export") public ResponseEntity<String> export(@PathVariable UUID id,@RequestParam(defaultValue="json") String format,@RequestParam(required=false) UUID plan) {
        Plan snapshot=plan==null?service.draft(id):service.plan(id,plan);
        if(!Set.of("json","html").contains(format)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Export format must be json or html.");
        String body=format.equals("json")?JsonMapper.builder().build().writerWithDefaultPrettyPrinter().writeValueAsString(snapshot):html(snapshot);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(format.equals("json")?"application/json":"text/html;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=ethics-plan-"+snapshot.kind().toLowerCase(Locale.ROOT)+"-"+snapshot.version()+"."+format).body(body);
    }
    private String html(Plan p) {
        StringBuilder b=new StringBuilder("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Ethics action plan</title><style>body{font:16px/1.6 system-ui;max-width:960px;margin:40px auto;padding:24px;color:#202124}article{border-top:1px solid #dadce0;margin-top:32px;padding-top:20px}pre{white-space:pre-wrap}dt{font-weight:600}dd{margin:0 0 12px;white-space:pre-wrap}</style><body>");
        b.append("<h1>").append(esc(p.projectName())).append("</h1><p>").append(p.kind()).append(" plan · Version ").append(p.version()).append("</p><p>Approval records planning decisions; implementation remains Not started. This plan does not certify compliance.</p><h2>Provenance</h2><dl>");
        pair(b,"Catalogue version",p.catalogueVersion()); pair(b,"Profile version",String.valueOf(p.profile().version())); pair(b,"Actor",p.actor()); pair(b,"Timestamp",p.at().toString()); pair(b,"Origin",p.origin());
        b.append("</dl><h2>Application profile</h2><dl>"); for(Field f:p.profile().fields()) pair(b,f.id(),f.status().equals("known")?f.value():f.status().replace('_',' ')); b.append("</dl><h2>Gaps and excluded work</h2><ul>");
        for(String gap:p.gaps()) b.append("<li>").append(esc(gap)).append("</li>"); b.append("</ul><h2>Action plan</h2>");
        for(Entry e:p.entries()) { var r=e.recommendation(); var s=e.source(); b.append("<article><h3>").append(esc(s.id())).append(" · ").append(s.category()).append("</h3><dl>");
            pair(b,"Review status",r.reviewStatus()); pair(b,"Implementation status",r.implementationStatus()); pair(b,"Concern scenario",r.scenario()); pair(b,"Adapted action",r.action()); pair(b,"Expected evidence",r.evidence()); pair(b,"Validation criterion",r.criterion().isBlank()?"Unresolved":r.criterion()); pair(b,"Owner",r.owner().isBlank()?"Unassigned":r.owner()); pair(b,"Phases",String.join(", ",r.phases())); pair(b,"Catalogue roles",String.join("; ",s.roles())); pair(b,"Rationale",r.rationale()); pair(b,"Original action",s.text()); pair(b,"Source cell",s.source()); pair(b,"References",String.join(", ",s.referenceIds())); b.append("</dl></article>"); }
        return b.append("</body></html>").toString();
    }
    private void pair(StringBuilder b,String key,String value) { b.append("<dt>").append(esc(key)).append("</dt><dd>").append(esc(value)).append("</dd>"); }
    private String esc(String s) { return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;"); }
}
