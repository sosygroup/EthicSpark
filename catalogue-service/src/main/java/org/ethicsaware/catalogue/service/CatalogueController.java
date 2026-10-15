package org.ethicsaware.catalogue.service;

import org.ethicsaware.catalogue.core.Catalogue;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/catalogue/versions")
public class CatalogueController {
    private final CatalogueStore store;
    public CatalogueController(CatalogueStore store) { this.store = store; }

    @GetMapping public List<CatalogueStore.Version> versions() { return store.versions(); }

    @GetMapping("/{version}") public CatalogueStore.Version version(@PathVariable String version) {
        return store.versions().stream().filter(v -> v.id().equals(version)).findFirst().orElseThrow(() -> missing("Catalogue version"));
    }

    @GetMapping("/{version}/report") public Catalogue.ImportReport report(@PathVariable String version) {
        return store.report(version).orElseThrow(() -> missing("Catalogue version"));
    }

    public record ClusterSummary(String id, String title, String definition, List<String> concerns, int actionCount, int labelMappingCount) {}
    @GetMapping("/{version}/cluster-details") public List<Catalogue.Cluster> clusterDetails(@PathVariable String version) { return catalogue(version).clusters(); }
    @GetMapping("/{version}/clusters") public List<ClusterSummary> clusters(@PathVariable String version, @RequestParam(defaultValue = "") String q) {
        String query = q.toLowerCase(Locale.ROOT).strip();
        return catalogue(version).clusters().stream().filter(c -> (c.id() + " " + c.title() + " " + c.definition() + " " + String.join(" ", c.concerns())).toLowerCase(Locale.ROOT).contains(query))
                .map(c -> new ClusterSummary(c.id(), c.title(), c.definition(), c.concerns(), c.actions().size(), c.labelMappings().size())).toList();
    }

    @GetMapping("/{version}/clusters/{id}") public Catalogue.Cluster cluster(@PathVariable String version, @PathVariable String id) {
        return catalogue(version).clusters().stream().filter(c -> c.id().equals(id)).findFirst().orElseThrow(() -> missing("Cluster"));
    }

    @GetMapping("/{version}/actions") public List<Catalogue.Action> actions(@PathVariable String version,
            @RequestParam(required = false) Catalogue.Category category, @RequestParam(required = false) String phase) {
        return catalogue(version).clusters().stream().flatMap(c -> c.actions().stream())
                .filter(a -> category == null || a.category() == category)
                .filter(a -> phase == null || a.allPhases() || a.phases().stream().anyMatch(p -> p.equalsIgnoreCase(phase)))
                .toList();
    }

    @GetMapping("/{version}/actions/{id}") public Catalogue.Action action(@PathVariable String version, @PathVariable String id) {
        return catalogue(version).clusters().stream().flatMap(c -> c.actions().stream()).filter(a -> a.id().equals(id)).findFirst().orElseThrow(() -> missing("Action"));
    }

    @GetMapping("/{version}/references") public List<Catalogue.Reference> references(@PathVariable String version) { return catalogue(version).references(); }
    @GetMapping("/{version}/references/{id}") public Catalogue.Reference reference(@PathVariable String version, @PathVariable String id) {
        return catalogue(version).references().stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow(() -> missing("Reference"));
    }

    @GetMapping("/{version}/source-cells") public Object sourceCells(@PathVariable String version, @RequestParam(required = false) String locator) {
        var cells = catalogue(version).sourceCells();
        if (locator == null) return cells;
        var cell = cells.get(locator);
        if (cell == null) throw missing("Source cell");
        return cell;
    }

    private Catalogue catalogue(String version) { return store.catalogue(version).orElseThrow(() -> missing("Catalogue version")); }
    private ResponseStatusException missing(String entity) { return new ResponseStatusException(HttpStatus.NOT_FOUND, entity + " not found."); }

    @RestControllerAdvice
    static class Errors {
        @ExceptionHandler(ResponseStatusException.class) ProblemDetail missing(ResponseStatusException e) {
            return ProblemDetail.forStatusAndDetail(e.getStatusCode(), e.getReason());
        }
        @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
        ProblemDetail invalidParameter() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid query parameter. Category values: KNOW, PROTECT, INFORM, ASSESS, VALIDATE, RESPOND."); }
        @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
        ProblemDetail oversizedUpload() { return ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE,"Each attachment must be at most 10 MiB."); }
        @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
        ProblemDetail malformedBody() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,"The request body is invalid or has missing required values."); }
    }
}
