package org.ethicsaware.catalogue.service;

import org.springframework.web.bind.annotation.*;
import java.util.*;
import static org.ethicsaware.catalogue.service.Reasoning.*;

@RestController
public class ReasoningController {
    private final ReasoningService reasoning;
    private final LlmGateway gateway;
    private final CompatibleProviderConfig compatible;
    private final org.springframework.jdbc.core.JdbcTemplate db;
    public ReasoningController(ReasoningService reasoning,LlmGateway gateway,CompatibleProviderConfig compatible,org.springframework.jdbc.core.JdbcTemplate db) { this.reasoning=reasoning;this.gateway=gateway;this.compatible=compatible;this.db=db; }
    @GetMapping("/api/reasoning/providers/compatible/config") public CompatibleProviderConfig.View compatibleConfig() {return compatible.view();}
    @PostMapping("/api/reasoning/providers/compatible/config") public CompatibleProviderConfig.View saveCompatible(@RequestBody CompatibleProviderConfig.Update update) {return compatible.save(update);}
    @GetMapping("/api/reasoning/providers") public List<Provider> providers() { return gateway.providers(); }
    @GetMapping("/api/reasoning/providers/{provider}/models") public List<String> models(@PathVariable String provider) { return gateway.models(provider); }
    @PostMapping("/api/reasoning/providers/ollama/thinking") public LlmGateway.ThinkingOptions thinking(@RequestBody LlmGateway.ThinkingRequest request) { return gateway.thinkingOptions(request); }
    @PostMapping("/api/reasoning/providers/ollama/prepare") public LlmGateway.Preparation prepare(@RequestBody LlmGateway.PrepareRequest request) { return gateway.prepare(request); }
    @PostMapping("/api/reasoning/providers/ollama/unload") public LlmGateway.Unloaded unload(@RequestBody LlmGateway.UnloadRequest request) {
        if(request.model()!=null && db.queryForObject("SELECT count(*) FROM assistant_message WHERE document->>'status'='pending' AND document->>'provider'='ollama' AND document->>'model'=?",Integer.class,request.model().strip())>0)
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"The model is answering a request. Wait before unloading it.");
        return gateway.unload(request);
    }
    @PostMapping("/api/projects/{project}/reasoning") public Run generate(@PathVariable UUID project,@RequestBody Request request) { return reasoning.generate(project,request); }
    @GetMapping("/api/projects/{project}/reasoning/{run}") public Run get(@PathVariable UUID project,@PathVariable UUID run) { return reasoning.get(project,run); }
    @PostMapping("/api/projects/{project}/reasoning/apply") public Workflow.Project apply(@PathVariable UUID project,@RequestBody Apply request) { return reasoning.apply(project,request); }
}
