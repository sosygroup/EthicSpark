package org.ethicsaware.catalogue.core;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import static org.ethicsaware.catalogue.core.Catalogue.*;

/** Strict importer for the consolidated workbook layout. Never evaluates formulas. */
public final class WorkbookImporter {
    private static final Set<String> PHASES = Set.of("Discovery", "Requirements", "Design", "Architecture",
            "Implementation", "Verification", "Release", "Pre-release", "Deployment", "Operations",
            "Maintenance", "Evolution", "Evolution Management", "Incident Response", "Recovery");

    public ImportResult read(byte[] bytes) throws IOException {
        String digest = sha256(bytes);
        List<Issue> issues = new ArrayList<>();
        Map<String, RawCell> raw = new TreeMap<>();
        List<Cluster> clusters = new ArrayList<>();
        List<Reference> references = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            for (Sheet sheet : workbook) {
                boolean clusterSheet = sheet.getSheetName().matches("C\\d{2}");
                if (!clusterSheet && !sheet.getSheetName().equals("References")) {
                    if (!sheet.getSheetName().equals("General"))
                        issue(issues, Severity.ERROR, "UNEXPECTED_SHEET", sheet.getSheetName(), "Unexpected worksheet; review the source layout.");
                    continue; // General contains contextual interview notes, not catalogue entities.
                }
                for (Row row : sheet) for (Cell cell : row) {
                    if (cell.getCellType() == CellType.BLANK) continue;
                    String value = cell.getCellType() == CellType.STRING ? cell.getStringCellValue()
                            : new DataFormatter(Locale.ROOT).formatCellValue(cell);
                    raw.put(source(sheet, row.getRowNum(), cell.getColumnIndex()), new RawCell(cell.getCellType().name(), value));
                    if (cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR)
                        issue(issues, Severity.ERROR, "UNSUPPORTED_CELL", source(sheet, row.getRowNum(), cell.getColumnIndex()), "Formula or error cells require a source review; no evaluation was performed.");
                }
                if (clusterSheet) readCluster(sheet, raw, clusters, issues);
                else readReferences(sheet, raw, references, issues);
            }
        }
        validate(clusters, references, issues);
        Catalogue catalogue = new Catalogue(digest, IMPORTER_VERSION, List.copyOf(clusters), List.copyOf(references), Map.copyOf(raw));
        ImportReport report = new ImportReport(digest, IMPORTER_VERSION, clusters.size(),
                clusters.stream().mapToInt(c -> c.actions().size()).sum(), references.size(), List.copyOf(issues));
        return new ImportResult(catalogue, report);
    }

    private void readCluster(Sheet s, Map<String, RawCell> raw, List<Cluster> clusters, List<Issue> issues) {
        int header = header(s, raw, 0, "ID", issues);
        int labels = header(s, raw, 5, "Ethics Label Cards", issues);
        int actionsHeader = header(s, raw, 0, "Action ID", issues);
        if (header < 0 || labels < 0 || actionsHeader < 0) return;
        expectHeaders(s, raw, header, new String[]{"ID", "Concern Cluster", "Definition / Scope", "Primary Concerns", "Detailed Semantic Rationale", "Boundary and Overlap Decisions", "Source References for the cluster and for the concerns definitions"}, issues);
        expectHeaders(s, raw, actionsHeader, new String[]{"Action ID", "Cycle", "Practical Action", "Concerns Covered", "Possible Evidence / Artifact", "SDLC Phase(s)", "Possible Responsible Role(s)", "Ref ID(s)", "Expert observations"}, issues);
        if (!text(s, raw, labels, 6).equals("Characteristics"))
            issue(issues, Severity.ERROR, "INVALID_HEADER", source(s, labels, 6), "Expected Characteristics header.");
        List<Integer> definitions = new ArrayList<>();
        for (int row = header + 1; row < labels; row++) if (!text(s, raw, row, 0).isBlank()) definitions.add(row);
        if (definitions.size() != 1) {
            issue(issues, Severity.ERROR, "CLUSTER_DEFINITION_COUNT", s.getSheetName(), "Expected one cluster definition row.");
            return;
        }
        int row = definitions.getFirst();
        String id = required(s, raw, row, 0, issues);
        if (text(s, raw, row, 5).isBlank()) issue(issues, Severity.WARNING, "MISSING_BOUNDARY_NOTES", source(s, row, 5), "No boundary notes supplied; no interpretation was invented.");
        String expectedId = "C-" + s.getSheetName().substring(1);
        if (!id.equals(expectedId)) issue(issues, Severity.ERROR, "CLUSTER_SHEET_MISMATCH", source(s, row, 0), "Expected " + expectedId + ".");
        List<LabelMapping> mappings = new ArrayList<>();
        for (int r = labels + 1; r < actionsHeader; r++) {
            String card = text(s, raw, r, 5), characteristic = text(s, raw, r, 6);
            if (card.isBlank() && characteristic.isBlank()) continue;
            mappings.add(new LabelMapping(required(s, raw, r, 5, issues), required(s, raw, r, 6, issues), source(s, r, 5)));
        }
        if (mappings.isEmpty()) issue(issues, Severity.ERROR, "MISSING_LABEL_MAPPING", s.getSheetName(), "At least one label mapping is required.");
        List<Action> actions = new ArrayList<>();
        for (int r = actionsHeader + 1; r <= s.getLastRowNum(); r++) {
            boolean empty = true;
            for (int c = 0; c < 9; c++) empty &= text(s, raw, r, c).isBlank();
            if (empty) continue;
            String actionId = required(s, raw, r, 0, issues);
            if (!actionId.matches(Pattern.quote(s.getSheetName()) + "-A[1-6]"))
                issue(issues, Severity.ERROR, "INVALID_ACTION_ID", source(s, r, 0), "Expected " + s.getSheetName() + "-A1 through -A6.");
            Category category = category(required(s, raw, r, 1, issues), source(s, r, 1), issues);
            String phaseText = required(s, raw, r, 5, issues);
            boolean allPhases = phaseText.equalsIgnoreCase("All SDLC phases");
            List<String> phases = allPhases ? List.of() : phases(phaseText, source(s, r, 5), issues);
            String roles = required(s, raw, r, 6, issues);
            if (roles.contains(",")) issue(issues, Severity.WARNING, "AMBIGUOUS_ROLE_DELIMITER", source(s, r, 6), "Comma-containing role text retained as a single semicolon-delimited item; review before publication.");
            actions.add(new Action(actionId, category, required(s, raw, r, 2, issues),
                    list(required(s, raw, r, 3, issues), ";"), required(s, raw, r, 4, issues), phases, allPhases,
                    list(roles, ";"), refs(required(s, raw, r, 7, issues), source(s, r, 7), issues),
                    text(s, raw, r, 8), source(s, r, 0)));
        }
        clusters.add(new Cluster(id, required(s, raw, row, 1, issues), required(s, raw, row, 2, issues),
                list(required(s, raw, row, 3, issues), ";"), required(s, raw, row, 4, issues), text(s, raw, row, 5),
                refs(required(s, raw, row, 6, issues), source(s, row, 6), issues), List.copyOf(mappings), List.copyOf(actions), source(s, row, 0)));
    }

    private void readReferences(Sheet s, Map<String, RawCell> raw, List<Reference> refs, List<Issue> issues) {
        int header = header(s, raw, 0, "Global Ref", issues);
        if (header < 0) return;
        expectHeaders(s, raw, header, new String[]{"Global Ref", "Reference", "Authors / Institution", "Year", "Source Type / Authority", "Accessible Link(s)"}, issues);
        for (int r = header + 1; r <= s.getLastRowNum(); r++) {
            boolean empty = true;
            for (int c = 0; c < 6; c++) empty &= text(s, raw, r, c).isBlank();
            if (empty) continue;
            String id = required(s, raw, r, 0, issues), title = required(s, raw, r, 1, issues);
            if (!id.matches("R-\\d{3}")) issue(issues, Severity.ERROR, "INVALID_REFERENCE_ID", source(s, r, 0), "Expected R-NNN reference identifier.");
            List<String> missing = new ArrayList<>();
            for (int c = 2; c < 6; c++) if (text(s, raw, r, c).isBlank()) missing.add(CellReference.convertNumToColString(c));
            if (!missing.isEmpty()) issue(issues, Severity.WARNING, "INCOMPLETE_REFERENCE_METADATA", source(s, r, 0), "Missing metadata in columns " + String.join(", ", missing) + "; no values were invented.");
            if (title.contains("...") || text(s, raw, r, 5).contains("..."))
                issue(issues, Severity.WARNING, "POSSIBLY_TRUNCATED_REFERENCE", source(s, r, 0), "Source contains an ellipsis; inspect title and links before publication.");
            refs.add(new Reference(id, title, text(s, raw, r, 2), text(s, raw, r, 3), text(s, raw, r, 4), text(s, raw, r, 5), source(s, r, 0)));
        }
    }

    private void validate(List<Cluster> clusters, List<Reference> references, List<Issue> issues) {
        checkIds(clusters.stream().map(Cluster::id).toList(), IntStream.rangeClosed(1, 24).mapToObj(i -> "C-%02d".formatted(i)).toList(), "CLUSTERS", issues);
        checkIds(references.stream().map(Reference::id).toList(), IntStream.rangeClosed(1, 184).mapToObj(i -> "R-%03d".formatted(i)).toList(), "REFERENCES", issues);
        Set<String> referenceIds = new HashSet<>(references.stream().map(Reference::id).toList());
        for (Cluster c : clusters) {
            String prefix = c.id().replace("-", "");
            checkIds(c.actions().stream().map(Action::id).toList(), IntStream.rangeClosed(1, 6).mapToObj(i -> prefix + "-A" + i).toList(), c.id() + "_ACTIONS", issues);
            List<Category> categories = c.actions().stream().map(Action::category).filter(Objects::nonNull).toList();
            if (categories.size() != 6 || new HashSet<>(categories).size() != 6)
                issue(issues, Severity.ERROR, "ACTION_CATEGORY_COVERAGE", c.source(), "Each cluster must contain each of the six categories exactly once.");
            checkRefs(c.referenceIds(), referenceIds, c.source(), issues);
            Set<String> concerns = new HashSet<>(c.concerns());
            for (Action a : c.actions()) {
                checkRefs(a.referenceIds(), referenceIds, a.source(), issues);
                if (!concerns.containsAll(a.concerns())) issue(issues, Severity.WARNING, "CONCERN_SCOPE_REVIEW", a.source(), "Action concerns contain terms outside the cluster's primary list; retained for review.");
            }
        }
    }

    private void checkIds(List<String> actual, List<String> expected, String code, List<Issue> issues) {
        if (actual.size() != new HashSet<>(actual).size()) issue(issues, Severity.ERROR, "DUPLICATE_" + code, code, "Duplicate source identifiers.");
        if (!new HashSet<>(actual).equals(new HashSet<>(expected))) issue(issues, Severity.ERROR, "INVALID_" + code + "_SET", code, "Source identifiers differ from the required registry.");
    }

    private void checkRefs(List<String> refs, Set<String> registry, String source, List<Issue> issues) {
        for (String ref : refs) if (!registry.contains(ref)) issue(issues, Severity.ERROR, "UNRESOLVED_REFERENCE", source, "Reference " + ref + " does not exist in this registry.");
    }

    private Category category(String raw, String source, List<Issue> issues) {
        if (raw.equalsIgnoreCase("Verify")) {
            issue(issues, Severity.INFO, "CATEGORY_ALIAS", source, raw + " -> Validate");
            return Category.VALIDATE;
        }
        try { return Category.valueOf(raw.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) { issue(issues, Severity.ERROR, "UNKNOWN_CATEGORY", source, "Unknown action category: " + raw); return null; }
    }

    private List<String> phases(String raw, String source, List<Issue> issues) {
        if (raw.contains(",")) issue(issues, Severity.INFO, "PHASE_DELIMITER", source, "Parsed comma and semicolon phase separators; original text retained.");
        return list(raw, "[;,]").stream().map(value -> {
            String canonical = switch (value.toLowerCase(Locale.ROOT)) {
                case "requirement", "requirements" -> "Requirements";
                case "operation", "operations" -> "Operations";
                default -> value;
            };
            if (!canonical.equals(value)) issue(issues, Severity.INFO, "PHASE_ALIAS", source, value + " -> " + canonical);
            if (!PHASES.contains(canonical)) issue(issues, Severity.WARNING, "UNMAPPED_PHASE", source, "Phase retained without semantic mapping: " + canonical);
            return canonical;
        }).toList();
    }

    private List<String> refs(String raw, String source, List<Issue> issues) {
        List<String> ids = list(raw, "[;,]");
        for (String id : ids) if (!id.matches("R-\\d{3}")) issue(issues, Severity.ERROR, "INVALID_REFERENCE_TOKEN", source, "Invalid reference token: " + id);
        if (ids.size() != new HashSet<>(ids).size()) issue(issues, Severity.WARNING, "DUPLICATE_REFERENCE_LINK", source, "Duplicate reference link retained for review.");
        return ids;
    }

    private List<String> list(String raw, String separator) { return Arrays.stream(raw.split(separator)).map(String::strip).filter(v -> !v.isBlank()).toList(); }
    private int header(Sheet s, Map<String, RawCell> raw, int col, String label, List<Issue> issues) {
        List<Integer> found = IntStream.rangeClosed(0, s.getLastRowNum()).filter(r -> text(s, raw, r, col).equals(label)).boxed().toList();
        if (found.size() == 1) return found.getFirst();
        issue(issues, Severity.ERROR, "INVALID_HEADER", s.getSheetName(), "Expected exactly one " + label + " header, found " + found.size() + ".");
        return -1;
    }
    private void expectHeaders(Sheet s, Map<String, RawCell> raw, int row, String[] expected, List<Issue> issues) {
        for (int c = 0; c < expected.length; c++) if (!text(s, raw, row, c).equals(expected[c]))
            issue(issues, Severity.ERROR, "INVALID_HEADER", source(s, row, c), "Expected column header: " + expected[c]);
    }
    private String required(Sheet s, Map<String, RawCell> raw, int r, int c, List<Issue> issues) {
        String value = text(s, raw, r, c);
        if (value.isBlank()) issue(issues, Severity.ERROR, "MISSING_VALUE", source(s, r, c), "Required catalogue value is missing.");
        return value;
    }
    private String text(Sheet s, Map<String, RawCell> raw, int r, int c) {
        RawCell cell = raw.get(source(s, r, c));
        return cell == null ? "" : cell.value().strip();
    }
    private static String source(Sheet s, int r, int c) { return s.getSheetName() + "!" + CellReference.convertNumToColString(c) + (r + 1); }
    private static void issue(List<Issue> issues, Severity severity, String code, String source, String message) { issues.add(new Issue(severity, code, source, message)); }
    public static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
