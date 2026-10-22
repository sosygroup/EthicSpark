package org.ethicsaware.catalogue.service;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.util.*;

@RestController
@RequestMapping("/api/assistant/maintenance")
public class WorkspaceMaintenanceController {
    private final WorkspaceMaintenance service;
    public WorkspaceMaintenanceController(WorkspaceMaintenance service) {this.service=service;}
    @GetMapping public WorkspaceMaintenance.Snapshot snapshot() {return service.snapshot();}
    @GetMapping("/export") public ResponseEntity<String> export() {return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=ethicspark-workspace.json").body(service.export());}
    @PostMapping("/reset") public Map<String,Boolean> reset(@RequestBody WorkspaceMaintenance.ResetRequest request) {service.reset(request);return Map.of("reset",true);}
    public record OperationRequest(UUID projectId) {}
    @PostMapping("/operations") public Map<String,UUID> begin(@RequestBody OperationRequest request) {return Map.of("id",service.beginOperation(request.projectId()));}
    @PostMapping("/operations/{id}/renew") public Map<String,Boolean> renew(@PathVariable UUID id) {service.renewOperation(id);return Map.of("active",true);}
    @DeleteMapping("/operations/{id}") public void end(@PathVariable UUID id) {service.endOperation(id);}
}
