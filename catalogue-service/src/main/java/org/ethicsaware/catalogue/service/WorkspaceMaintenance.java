package org.ethicsaware.catalogue.service;

import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;
import java.util.*;

/** Explicit local workspace maintenance. Never touches catalogue tables, host folders or credentials. */
@Service
public class WorkspaceMaintenance {
    private static final List<String> TABLES=List.of("assistant_demo","assistant_receipt","assistant_message","assistant_thread","assistant_project","reasoning_run","profile_attachment","plan_version","review_event","profile_version","workflow_project");
    private final JdbcTemplate db;
    private final AssistantService assistant;
    private final TransactionTemplate tx;
    private final JsonMapper json=JsonMapper.builder().build();
    private final Map<UUID,Instant> operations=new HashMap<>();
    private int requests;
    private boolean resetting;
    public WorkspaceMaintenance(JdbcTemplate db,AssistantService assistant,org.springframework.transaction.PlatformTransactionManager manager) {this.db=db;this.assistant=assistant;tx=new TransactionTemplate(manager);}
    public record ResetRequest(String confirmation,String snapshotToken) {}
    public record Snapshot(Map<String,Integer> counts,String snapshotToken,boolean available,String reason) {}
    public synchronized void enterRequest() {if(resetting)throw conflict("Workspace reset is in progress. Wait and reload the app.");requests++;}
    public synchronized void leaveRequest() {requests--;}
    private void expire() {operations.values().removeIf(at->at.isBefore(Instant.now()));}
    public synchronized UUID beginOperation(UUID project) {
        expire();if(resetting)throw conflict("Workspace reset is in progress.");
        if(project==null||!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS (SELECT 1 FROM assistant_project WHERE id=? AND deleted_at IS NULL)",Boolean.class,project)))throw conflict("The project is no longer available. Reload the app.");
        UUID id=UUID.randomUUID();operations.put(id,Instant.now().plusSeconds(180));return id;
    }
    public synchronized void renewOperation(UUID id) {expire();if(!operations.containsKey(id))throw conflict("Operation permission expired. Review the operation again.");operations.put(id,Instant.now().plusSeconds(180));}
    public synchronized void endOperation(UUID id) {operations.remove(id);}
    private synchronized String unavailable() {expire();return resetting?"Workspace reset is in progress.":requests>0||!operations.isEmpty()?"Wait for running requests, uploads and native operations to finish.":"";}
    private void lockTables() {db.execute("LOCK TABLE "+String.join(",",TABLES)+" IN ACCESS EXCLUSIVE MODE");}
    private Map<String,Object> rows() {
        Map<String,Object> tables=new LinkedHashMap<>();
        for(String table:TABLES) {
            String order=table.equals("assistant_demo")?"name":table.equals("profile_version")?"project_id,version":"id";
            String projection=table.equals("profile_attachment")?"(to_jsonb(t)-'content') || jsonb_build_object('contentBase64',encode(content,'base64'))":"to_jsonb(t)";
            tables.put(table,db.query("SELECT ("+projection+")::text FROM "+table+" t ORDER BY "+order,(rs,n)->json.readTree(rs.getString(1))));
        }
        return tables;
    }
    private String token(Map<String,Object> rows) {return org.ethicsaware.catalogue.core.WorkbookImporter.sha256(json.writeValueAsString(rows).getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    public Snapshot snapshot() {
        String availability=unavailable();
        return tx.execute(status->{lockTables();var rows=rows();Map<String,Integer> counts=new LinkedHashMap<>();rows.forEach((k,v)->counts.put(k,((List<?>)v).size()));
            String reason=availability;if(reason.isEmpty()&&pending())reason="Stop or wait for pending model responses before resetting.";
            return new Snapshot(counts,token(rows),reason.isEmpty(),reason);
        });
    }
    private boolean pending() {return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS (SELECT 1 FROM assistant_message WHERE document->>'status'='pending')",Boolean.class));}
    public String export() {return tx.execute(status->{lockTables();var rows=rows();return json.writeValueAsString(Map.of("format","ethicspark-workspace-export-1","createdAt",Instant.now().toString(),"snapshotToken",token(rows),"tables",rows,"notice","Contains workspace data and attachment bytes (base64), including Trash and legacy workflow records. No configured provider credentials, catalogue workbook or live folder files. User-provided content may itself contain sensitive information. Archival export; automatic import is not available."));});}
    public void reset(ResetRequest request) {
        if(request==null||!"RESET".equals(request.confirmation())||request.snapshotToken()==null||request.snapshotToken().isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Type RESET and review the current workspace summary first.");
        synchronized(this) {String reason=unavailable();if(!reason.isEmpty())throw conflict(reason);resetting=true;}
        try {
            tx.executeWithoutResult(status->{lockTables();if(pending())throw conflict("Stop or wait for pending model responses before resetting.");if(!token(rows()).equals(request.snapshotToken()))throw conflict("The workspace changed. Refresh the summary and review it again before resetting.");
                // TRUNCATE is restricted to this explicit maintenance operation. Normal immutable-history triggers remain intact.
                db.execute("TRUNCATE TABLE "+String.join(",",TABLES));
                assistant.loadDemo();
            });
        }finally{synchronized(this){resetting=false;}}
    }
    private ResponseStatusException conflict(String message) {return new ResponseStatusException(HttpStatus.CONFLICT,message);}
}
