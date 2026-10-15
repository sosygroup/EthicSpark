package org.ethicsaware.catalogue.service;

import org.springframework.web.bind.annotation.*;
import java.util.*;
import static org.ethicsaware.catalogue.service.Reasoning.*;

@RestController
public class ReasoningController {
    private final ReasoningService reasoning;
    private final LlmGateway gateway;
    public ReasoningController(ReasoningService reasoning,LlmGateway gateway) { this.reasoning=reasoning;this.gateway=gateway; }
    @GetMapping("/api/reasoning/providers") public List<Provider> providers() { return gateway.providers(); }
    @GetMapping("/api/reasoning/providers/{provider}/models") public List<String> models(@PathVariable String provider) { return gateway.models(provider); }
    @PostMapping("/api/projects/{project}/reasoning") public Run generate(@PathVariable UUID project,@RequestBody Request request) { return reasoning.generate(project,request); }
    @GetMapping("/api/projects/{project}/reasoning/{run}") public Run get(@PathVariable UUID project,@PathVariable UUID run) { return reasoning.get(project,run); }
    @PostMapping("/api/projects/{project}/reasoning/apply") public Workflow.Project apply(@PathVariable UUID project,@RequestBody Apply request) { return reasoning.apply(project,request); }
}
