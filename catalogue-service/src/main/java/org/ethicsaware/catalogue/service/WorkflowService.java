package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.Catalogue;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.*;
import static org.ethicsaware.catalogue.service.Workflow.*;

@Service
public class WorkflowService {
    private final JdbcTemplate db;
    private final CatalogueStore catalogues;
    private final AttachmentService attachments;
    private final JsonMapper json = JsonMapper.builder().build();
    public WorkflowService(JdbcTemplate db, CatalogueStore catalogues, AttachmentService attachments) { this.db = db; this.catalogues = catalogues; this.attachments=attachments; }

    public List<Summary> list() {
        return db.query("SELECT id,name,revision,document::text,updated_at FROM workflow_project ORDER BY updated_at DESC", (rs,n) -> {
            Project p = json.readValue(rs.getString("document"), Project.class);
            return new Summary(p.id(), p.name(), p.revision(), p.profile().version(), p.profile().confirmed(), rs.getTimestamp("updated_at").toInstant());
        });
    }
    public Project get(UUID id) { return read(id, false); }
    private Project read(UUID id, boolean lock) {
        return db.query("SELECT document::text FROM workflow_project WHERE id=?" + (lock ? " FOR UPDATE" : ""),
                (rs,n) -> json.readValue(rs.getString(1), Project.class), id).stream().findFirst().orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Project not found."));
    }
    private Catalogue catalogue(Project p) { return catalogues.catalogue(p.catalogueVersion()).orElseThrow(() -> error(HttpStatus.CONFLICT,"Project catalogue is unavailable.")); }
    private Catalogue.Cluster c01(Project p) { return catalogue(p).clusters().stream().filter(c -> c.id().equals("C-01")).findFirst().orElseThrow(); }
    private String actor(String actor) { return required(actor, "Reviewer name"); }
    private String required(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 20000) throw error(HttpStatus.BAD_REQUEST,field + " is required and must be at most 20,000 characters.");
        return value.strip();
    }
    private String text(String value) {
        if (value == null || value.length() > 20000) throw error(HttpStatus.BAD_REQUEST,"Invalid or oversized text field.");
        return value.strip();
    }
    private void revision(Project p, int revision) { if (p.revision() != revision) throw error(HttpStatus.CONFLICT,"This project changed in another session. Reload it before saving."); }
    private void confirmed(Project p) { if (!p.profile().confirmed()) throw error(HttpStatus.CONFLICT,"Confirm the current application profile first."); }

    @Transactional public Project create(Create request) {
        String actor = actor(request.actor()), name = required(request.name(),"Project name");
        var versions = catalogues.versions();
        if (versions.isEmpty()) throw error(HttpStatus.CONFLICT,"Import a catalogue before creating a project.");
        Profile profile = new Profile(0,false,FIELD_IDS.stream().map(id -> new Field(id,"","known")).toList());
        Project base = new Project(UUID.randomUUID(), name, versions.getFirst().id(),0,profile,List.of(),List.of());
        List<Recommendation> recommendations = c01(base).actions().stream().map(a -> new Recommendation(a.id(),"",a.text(),a.evidence(),"","","",a.phases(),"proposed","not_started","")).toList();
        Project p = new Project(base.id(),name,base.catalogueVersion(),0,profile,List.of(),recommendations);
        db.update("INSERT INTO workflow_project(id,name,catalogue_version,document) VALUES (?,?,?,CAST(? AS jsonb))", p.id(),name,p.catalogueVersion(),json.writeValueAsString(p));
        event(p,actor,"project_created",null,"",null,p);
        return p;
    }

    @Transactional public Project profile(UUID id, ProfileChange request) {
        Project p = read(id,true); revision(p,request.revision()); String actor = actor(request.actor());
        if (request.fields() == null || request.fields().size()<8 || request.fields().size()>FIELD_IDS.size()) throw error(HttpStatus.BAD_REQUEST,"Supply every application-profile field.");
        Set<String> seen = new HashSet<>(); List<Field> fields = new ArrayList<>();
        for (Field f : request.fields()) {
            if (f == null || f.id()==null || f.status()==null || !FIELD_IDS.contains(f.id()) || !seen.add(f.id()) || !Set.of("known","unknown","not_applicable","none","company_ethics").contains(f.status()))
                throw error(HttpStatus.BAD_REQUEST,"Invalid profile field or status.");
            if(f.status().equals("none")&&!f.id().equals("sharing") || f.status().equals("company_ethics")&&!f.id().equals("safeguards")) throw error(HttpStatus.BAD_REQUEST,"This status is not supported by this field.");
            String value = f.status().equals("none")?NO_SHARING:text(f.value());
            attachments.validate(id,f.id(),f.files());
            attachments.validate(id,"company_ethics",f.companyEthics());
            if(!f.id().equals("safeguards")&&!f.companyEthics().isEmpty()) throw error(HttpStatus.BAD_REQUEST,"Company ethics belongs to Existing safeguards.");
            if(Set.of("unknown","not_applicable").contains(f.status()) && (!value.isBlank()||!f.files().isEmpty())) throw error(HttpStatus.BAD_REQUEST,"Unknown or not applicable fields must not contain asserted facts or field attachments.");
            if(f.status().equals("none")&&!f.files().isEmpty()) throw error(HttpStatus.BAD_REQUEST,"None must not contain sharing attachments.");
            if(request.confirm() && f.status().equals("company_ethics") && f.companyEthics().isEmpty()) throw error(HttpStatus.BAD_REQUEST,"Upload your company's internal regulations.");
            if (request.confirm() && f.status().equals("known") && !f.id().equals("additional") && value.isBlank() && f.files().isEmpty()) throw error(HttpStatus.BAD_REQUEST,"Provide text or a file, or explicitly select Unknown / Not applicable for " + f.id() + ".");
            fields.add(new Field(f.id(),value,f.status(),f.files(),f.companyEthics()));
        }
        if(!seen.containsAll(FIELD_IDS.subList(0,8))) throw error(HttpStatus.BAD_REQUEST,"Supply every required profile field.");
        if(!seen.contains("additional")) fields.add(new Field("additional","","known"));
        fields.sort(Comparator.comparingInt(f -> FIELD_IDS.indexOf(f.id())));
        boolean changed = !fields.equals(p.profile().fields());
        if (p.profile().confirmed() && !changed) return p;
        int version = p.profile().version();
        if (request.confirm()) {
            version++;
            Profile saved = new Profile(version,true,List.copyOf(fields));
            db.update("INSERT INTO profile_version(project_id,version,document,confirmed_by) VALUES (?,?,CAST(? AS jsonb),?)",id,version,json.writeValueAsString(saved),actor);
        }
        Profile profile = new Profile(version,request.confirm(),List.copyOf(fields));
        List<Recommendation> recs = changed ? p.recommendations().stream().map(r -> new Recommendation(r.sourceActionId(),r.scenario(),r.action(),r.evidence(),r.criterion(),r.owner(),r.rationale(),r.phases(),"proposed","not_started",p.profile().version()>0?"Profile changed; review this recommendation again.":"",r.applicability(),r.applicabilityReason())).toList() : p.recommendations();
        Project next = save(p,profile,p.selectedClusters(),recs);
        event(next,actor,request.confirm()?"profile_confirmed":"profile_saved",null,changed?"All recommendations require review after a profile change.":"",p.profile(),profile);
        return next;
    }

    @Transactional public Project selection(UUID id, SelectionChange request) {
        Project p = read(id,true); revision(p,request.revision()); confirmed(p); String actor = actor(request.actor());
        Set<String> available=new HashSet<>(catalogue(p).clusters().stream().map(Catalogue.Cluster::id).toList());
        if (request.clusterIds() == null || request.clusterIds().size()>24 || new HashSet<>(request.clusterIds()).size()!=request.clusterIds().size() || !available.containsAll(request.clusterIds()))
            throw error(HttpStatus.BAD_REQUEST,"Select valid, distinct catalogue clusters.");
        Map<String,Recommendation> existing=new HashMap<>(); p.recommendations().forEach(r->existing.put(r.sourceActionId(),r));
        List<Recommendation> recs=catalogue(p).clusters().stream().filter(c->request.clusterIds().contains(c.id())).flatMap(c->c.actions().stream()).map(a->existing.getOrDefault(a.id(),new Recommendation(a.id(),"",a.text(),a.evidence(),"","","",a.phases(),"proposed","not_started",""))).toList();
        Project next = save(p,p.profile(),List.copyOf(request.clusterIds()),recs);
        event(next,actor,"selection_saved",null,"Manual selection",p.selectedClusters(),next.selectedClusters()); return next;
    }

    @Transactional public Project recommendation(UUID id, String actionId, RecommendationChange request) {
        Project p = read(id,true); revision(p,request.revision()); confirmed(p); String actor = actor(request.actor());
        if (p.selectedClusters().stream().noneMatch(c->actionId.startsWith(c.replace("-","")+"-"))) throw error(HttpStatus.CONFLICT,"Select this cluster before adapting its actions.");
        Recommendation before = p.recommendations().stream().filter(r -> r.sourceActionId().equals(actionId)).findFirst().orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Action not found."));
        Recommendation r = request.recommendation();
        if (r == null || !actionId.equals(r.sourceActionId())) throw error(HttpStatus.BAD_REQUEST,"Source action ID does not match.");
        if (request.decision()==null || !Set.of("save","accept","reject","awaiting_information").contains(request.decision())) throw error(HttpStatus.BAD_REQUEST,"Unsupported review decision.");
        String action = required(r.action(),"Adapted action"), evidence = required(r.evidence(),"Expected evidence");
        String scenario=text(r.scenario()), criterion=text(r.criterion()), owner=text(r.owner()), rationale=text(r.rationale()), reason=text(r.reason());
        if (request.decision().equals("reject") && reason.isBlank()) throw error(HttpStatus.BAD_REQUEST,"Give a reason for rejection.");
        if (request.decision().equals("accept") && scenario.isBlank()) throw error(HttpStatus.BAD_REQUEST,"Describe the application-specific concern scenario before accepting.");
        if (r.phases()==null || r.phases().size()>30 || r.phases().stream().anyMatch(v -> v==null || v.isBlank() || v.length()>100)) throw error(HttpStatus.BAD_REQUEST,"Invalid phase list.");
        var source = catalogue(p).clusters().stream().flatMap(c->c.actions().stream()).filter(a -> a.id().equals(actionId)).findFirst().orElseThrow();
        boolean edited = !source.text().equals(action) || !source.evidence().equals(evidence) || !source.phases().equals(r.phases());
        if(request.decision().equals("accept")&&!r.applicability().equals("suitable")) throw error(HttpStatus.BAD_REQUEST,"Resolve phase suitability before accepting. You can reject the action or await information instead.");
        if(!r.applicability().equals(before.applicability())&&r.applicabilityReason().isBlank()) throw error(HttpStatus.BAD_REQUEST,"Explain a change to phase suitability.");
        String status = switch(request.decision()) { case "accept" -> edited?"edited":"accepted"; case "reject" -> "rejected"; case "awaiting_information" -> "awaiting_information"; default -> "proposed"; };
        if(!Set.of("suitable","not_applicable","uncertain").contains(r.applicability())) throw error(HttpStatus.BAD_REQUEST,"Invalid applicability.");
        Recommendation after = new Recommendation(actionId,scenario,action,evidence,criterion,owner,rationale,List.copyOf(r.phases()),status,"not_started",reason,r.applicability(),text(r.applicabilityReason()));
        List<Recommendation> recs = p.recommendations().stream().map(a -> a.sourceActionId().equals(actionId)?after:a).toList();
        Project next=save(p,p.profile(),p.selectedClusters(),recs); event(next,actor,"recommendation_"+request.decision(),actionId,reason,before,after); return next;
    }

    @Transactional public Project applyReasoning(UUID id,Reasoning.Apply request,Reasoning.Run run) {
        Project p=read(id,true); revision(p,request.revision()); confirmed(p); String actor=actor(request.actor());
        if(run.revision()!=p.revision() || run.profileVersion()!=p.profile().version() || !run.catalogueVersion().equals(p.catalogueVersion())) throw error(HttpStatus.CONFLICT,"This proposal is stale. Run the analysis again for the current profile and project.");
        List<String> selected=request.clusters().stream().map(Reasoning.ClusterProposal::clusterId).toList();
        List<Recommendation> recs=run.output().recommendations().stream().filter(r->selected.stream().anyMatch(c->r.sourceActionId().startsWith(c.replace("-","")+"-"))).toList();
        Reasoning.Run reviewed=new Reasoning.Run(run.id(),run.revision(),run.profileVersion(),run.catalogueVersion(),run.provider(),run.model(),run.promptVersion(),run.at(),run.inputSha256(),run.outputSha256(),new Reasoning.Output(request.clusters(),recs,run.output().uncertainties()));
        Project next=new Project(p.id(),p.name(),p.catalogueVersion(),p.revision()+1,p.profile(),selected,recs,reviewed);
        db.update("UPDATE workflow_project SET revision=?,document=CAST(? AS jsonb),updated_at=current_timestamp WHERE id=?",next.revision(),json.writeValueAsString(next),id);
        event(next,actor,"reasoning_proposal_applied",null,"Model suggestions retained as Proposed; no actions accepted automatically.",p,reviewed);
        return next;
    }

    private Project save(Project previous, Profile profile, List<String> selection, List<Recommendation> recs) {
        Project next = new Project(previous.id(),previous.name(),previous.catalogueVersion(),previous.revision()+1,profile,selection,recs,previous.reasoning());
        db.update("UPDATE workflow_project SET revision=?,document=CAST(? AS jsonb),updated_at=current_timestamp WHERE id=?",next.revision(),json.writeValueAsString(next),next.id()); return next;
    }
    private void event(Project p,String actor,String operation,String action,String reason,Object before,Object after) {
        Event e = new Event(UUID.randomUUID(),actor,Instant.now(),operation,action,reason,before,after);
        db.update("INSERT INTO review_event(id,project_id,document) VALUES (?,?,CAST(? AS jsonb))",e.id(),p.id(),json.writeValueAsString(e));
    }
    public List<Event> history(UUID id) {
        get(id);
        return db.query("SELECT document::text FROM review_event WHERE project_id=? ORDER BY occurred_at DESC,id",(rs,n)->json.readValue(rs.getString(1),Event.class),id);
    }
    public List<PlanSummary> plans(UUID id) {
        get(id); return db.query("SELECT id,version,approved_at FROM plan_version WHERE project_id=? ORDER BY version DESC",(rs,n)->new PlanSummary(rs.getObject(1,UUID.class),rs.getInt(2),rs.getTimestamp(3).toInstant()),id);
    }
    public Plan plan(UUID project, UUID plan) {
        return db.query("SELECT document::text FROM plan_version WHERE project_id=? AND id=?",(rs,n)->json.readValue(rs.getString(1),Plan.class),project,plan).stream().findFirst().orElseThrow(()->error(HttpStatus.NOT_FOUND,"Plan version not found."));
    }
    public Plan draft(UUID id) { return snapshot(get(id),"DRAFT",0,"Local draft",false); }
    public Plan approvalPreview(UUID id) { return snapshot(get(id),"APPROVAL_PREVIEW",0,"Pending approval",true); }

    @Transactional public Plan approve(UUID id, Approval request) {
        Project p = read(id,true); String actor = actor(request.actor());
        if(request.requestKey()==null) throw error(HttpStatus.BAD_REQUEST,"Approval request key is required.");
        var existing = db.query("SELECT request_revision,document::text FROM plan_version WHERE project_id=? AND request_key=?",(rs,n)->Map.entry(rs.getInt(1),json.readValue(rs.getString(2),Plan.class)),id,request.requestKey());
        if(!existing.isEmpty()) {
            if(existing.getFirst().getKey()!=request.revision() || !existing.getFirst().getValue().actor().equals(actor)) throw error(HttpStatus.CONFLICT,"Approval request key was already used for different input.");
            return existing.getFirst().getValue();
        }
        revision(p,request.revision()); confirmed(p);
        int version=db.queryForObject("SELECT COALESCE(MAX(version),0)+1 FROM plan_version WHERE project_id=?",Integer.class,id);
        Plan plan=snapshot(p,"APPROVED",version,actor,true);
        if(plan.entries().isEmpty()) throw error(HttpStatus.CONFLICT,"Accept at least one selected recommendation before approval.");
        db.update("INSERT INTO plan_version(id,project_id,version,request_key,request_revision,document) VALUES (?,?,?,?,?,CAST(? AS jsonb))",plan.id(),id,version,request.requestKey(),request.revision(),json.writeValueAsString(plan));
        save(p,p.profile(),p.selectedClusters(),p.recommendations());
        event(p,actor,"plan_approved",null,"Approved version "+version+" with "+plan.gaps().size()+" recorded gaps.",null,plan.id()); return plan;
    }

    private Plan snapshot(Project p,String kind,int version,String actor,boolean approved) {
        List<Entry> entries=new ArrayList<>(); List<String> gaps=new ArrayList<>(), excluded=new ArrayList<>();
        Map<String,Catalogue.Action> sources=new HashMap<>();catalogue(p).clusters().forEach(c->c.actions().forEach(a->sources.put(a.id(),a)));
        Set<UUID> fileIds=new LinkedHashSet<>();p.profile().fields().forEach(f->{fileIds.addAll(f.files());fileIds.addAll(f.companyEthics());});
        List<AttachmentSummary> manifest=fileIds.stream().map(id->{var f=attachments.get(p.id(),id);return new AttachmentSummary(f.id(),f.fieldId(),f.name(),f.size(),f.sha256(),f.extraction());}).toList();
        for(var file:manifest) if(!file.extraction().equals("Text extracted.")) gaps.add(file.name()+": "+file.extraction());
        if(p.reasoning()!=null) gaps.addAll(p.reasoning().output().uncertainties());
        if(!p.profile().confirmed()) gaps.add("Application profile is not confirmed.");
        for(Field f:p.profile().fields()) if(!f.id().equals("additional") && (f.status().equals("unknown") || (f.status().equals("known") && f.value().isBlank() && f.files().isEmpty()))) gaps.add("Unresolved application field: "+f.id());
        if(p.selectedClusters().isEmpty()) gaps.add("No cluster selected.");
        for(Recommendation r:p.recommendations()) {
            boolean accepted=Set.of("accepted","edited").contains(r.reviewStatus());
            if(p.selectedClusters().stream().noneMatch(c->r.sourceActionId().startsWith(c.replace("-","")+"-")) || (approved && !accepted)) { excluded.add(r.sourceActionId()); gaps.add(r.sourceActionId()+": excluded ("+r.reviewStatus()+")."+(r.reason().isBlank()?"":" "+r.reason())); continue; }
            Catalogue.Action source=Objects.requireNonNull(sources.get(r.sourceActionId()));
            entries.add(new Entry(r,source));
            if(!r.applicability().equals("suitable")) gaps.add(r.sourceActionId()+": "+r.applicability()+" — "+r.applicabilityReason());
            if(r.owner().isBlank()) gaps.add(r.sourceActionId()+": owner is Unassigned.");
            if(r.criterion().isBlank()) gaps.add(r.sourceActionId()+": validation criterion is unresolved.");
            if(r.rationale().isBlank()) gaps.add(r.sourceActionId()+": adaptation rationale is missing.");
            if(!r.reason().isBlank()) gaps.add(r.sourceActionId()+": "+r.reason());
        }
        gaps.add("Catalogue is imported with "+catalogues.report(p.catalogueVersion()).orElseThrow().warningCount()+" source-review warnings; publication review is pending.");
        return new Plan(UUID.randomUUID(),p.id(),p.name(),kind,version,p.catalogueVersion(),p.revision(),p.profile(),actor,Instant.now(),List.copyOf(entries),List.copyOf(gaps),List.copyOf(excluded),p.reasoning()==null?"Manual catalogue adaptation; no LLM used":"LLM-assisted draft: "+p.reasoning().provider()+" / "+p.reasoning().model()+"; prompt "+p.reasoning().promptVersion()+"; run "+p.reasoning().id()+"; human review required",p.reasoning(),manifest);
    }
    private ResponseStatusException error(HttpStatus status,String detail) { return new ResponseStatusException(status,detail); }
}
