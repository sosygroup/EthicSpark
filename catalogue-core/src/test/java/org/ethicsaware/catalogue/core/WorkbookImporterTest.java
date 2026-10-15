package org.ethicsaware.catalogue.core;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.ethicsaware.catalogue.core.Catalogue.*;

class WorkbookImporterTest {
    private byte[] source() throws Exception { return Files.readAllBytes(Path.of(System.getProperty("catalogue.test.workbook"))); }
    private ImportResult original() throws Exception { return new WorkbookImporter().read(source()); }
    private ImportResult changed(Consumer<XSSFWorkbook> change) throws Exception {
        try (var workbook = new XSSFWorkbook(new java.io.ByteArrayInputStream(source())); var out = new ByteArrayOutputStream()) {
            change.accept(workbook); workbook.write(out);
            return new WorkbookImporter().read(out.toByteArray());
        }
    }
    private void hasError(ImportResult r, String code) {
        assertThat(r.report().valid()).isFalse();
        assertThat(r.report().issues()).anyMatch(i -> i.severity() == Severity.ERROR && i.code().equals(code));
    }

    @Test void importsFullWorkbookWithValidRelationshipsAndExactC01Evidence() throws Exception {
        var r = original();
        assertThat(r.report().issues().stream().filter(i -> i.severity() == Severity.ERROR).toList()).isEmpty();
        assertThat(r.report().valid()).isTrue();
        assertThat(r.report().clusterCount()).isEqualTo(24);
        assertThat(r.report().actionCount()).isEqualTo(144);
        assertThat(r.report().referenceCount()).isEqualTo(184);
        var c = r.catalogue().clusters().stream().filter(v -> v.id().equals("C-01")).findFirst().orElseThrow();
        assertThat(c.title()).isEqualTo("Privacy & Data Protection");
        assertThat(c.labelMappings()).hasSize(8);
        assertThat(c.actions()).extracting(Action::id).containsExactly("C01-A1", "C01-A2", "C01-A3", "C01-A4", "C01-A5", "C01-A6");
        assertThat(c.actions().getFirst().referenceIds()).containsExactly("R-001", "R-007", "R-058");
        assertThat(c.actions().get(4).category()).isEqualTo(Category.VALIDATE);
        assertThat(r.catalogue().sourceCells().get("C01!C28").value()).isEqualTo(c.actions().getFirst().text());
        assertThat(r.catalogue().sourceCells().get("C01!G9").value()).endsWith("\n");
        assertThat(r.catalogue().sourceCells()).doesNotContainKey("General!A2");
        assertThat(r.catalogue().sourceCells()).doesNotContainKey("C23!I28");
        assertThat(r.catalogue().clusters().stream().flatMap(cluster -> cluster.actions().stream()))
                .allMatch(action -> action.expertObservations().isBlank());
        assertThat(r.catalogue().sourceSha256()).isEqualTo(WorkbookImporter.sha256(source()));
    }

    @Test void normalisesOnlyAgreedAliasesAndKeepsRawCells() throws Exception {
        var r = changed(w -> {
            w.getSheet("C01").getRow(31).getCell(1).setCellValue(" Verify ");
            w.getSheet("C01").getRow(27).getCell(5).setCellValue(" requirement; operation; Architecture ");
        });
        assertThat(r.report().valid()).isTrue();
        var actions = r.catalogue().clusters().getFirst().actions();
        assertThat(actions.get(4).category()).isEqualTo(Category.VALIDATE);
        assertThat(actions.getFirst().phases()).containsExactly("Requirements", "Operations", "Architecture");
        assertThat(r.catalogue().sourceCells().get("C01!F28").value()).isEqualTo(" requirement; operation; Architecture ");
        assertThat(r.report().issues()).anyMatch(i -> i.code().equals("CATEGORY_ALIAS"));
        assertThat(r.report().issues()).anyMatch(i -> i.code().equals("PHASE_ALIAS"));
    }

    @Test void readsUpdatedCommaListsAndEscapedLineBreaksWithoutChangingRawEvidence() throws Exception {
        var result=original();var c=result.catalogue().clusters().getFirst();
        assertThat(c.actions().getFirst().roles()).containsExactly("Product/Service Owner","Privacy or Data Owner","Architecture/Engineering");
        assertThat(c.actions().getFirst().phases()).containsExactly("Requirements","Design");
        assertThat(c.labelMappings()).allMatch(m->!m.characteristic().contains("\\n"));
        assertThat(result.catalogue().sourceCells().get("C01!F28").value()).isEqualTo("Requirement, Design");
        assertThat(result.report().issues()).anyMatch(i->i.code().equals("ROLE_DELIMITER")).anyMatch(i->i.code().equals("PHASE_ALIAS"));
    }

    @Test void blocksDuplicateActionIds() throws Exception {
        hasError(changed(w -> w.getSheet("C01").getRow(28).getCell(0).setCellValue("C01-A1")), "DUPLICATE_C-01_ACTIONS");
    }
    @Test void blocksMissingCluster() throws Exception {
        hasError(changed(w -> w.removeSheetAt(w.getSheetIndex("C24"))), "INVALID_CLUSTERS_SET");
    }
    @Test void blocksMissingReferenceEvenWhenActionCountIsUnchanged() throws Exception {
        hasError(changed(w -> w.getSheet("References").removeRow(w.getSheet("References").getRow(189))), "INVALID_REFERENCES_SET");
    }
    @Test void blocksUnknownReferenceTarget() throws Exception {
        hasError(changed(w -> w.getSheet("C01").getRow(27).getCell(7).setCellValue("R-999")), "UNRESOLVED_REFERENCE");
    }
    @Test void blocksUnknownCategoryAndDuplicateCategory() throws Exception {
        hasError(changed(w -> w.getSheet("C01").getRow(27).getCell(1).setCellValue("Approve")), "UNKNOWN_CATEGORY");
        hasError(changed(w -> w.getSheet("C01").getRow(28).getCell(1).setCellValue("Know")), "ACTION_CATEGORY_COVERAGE");
    }
    @Test void blocksChangedColumnLayoutAndMissingRequiredText() throws Exception {
        hasError(changed(w -> w.getSheet("C01").getRow(26).getCell(7).setCellValue("Moved References")), "INVALID_HEADER");
        hasError(changed(w -> w.getSheet("C01").getRow(27).getCell(2).setBlank()), "MISSING_VALUE");
    }
    @Test void blocksFormulaWithoutEvaluatingIt() throws Exception {
        hasError(changed(w -> w.getSheet("C01").getRow(27).getCell(2).setCellFormula("1+1")), "UNSUPPORTED_CELL");
    }
    @Test void retainsAmbiguousRolesAndUnmappedPhasesWithWarnings() throws Exception {
        var r = changed(w -> {
            w.getSheet("C01").getRow(27).getCell(6).setCellValue("QA, Engineering; Product");
            w.getSheet("C01").getRow(27).getCell(5).setCellValue("Architecture; Procurement");
        });
        assertThat(r.report().valid()).isTrue();
        var a = r.catalogue().clusters().getFirst().actions().getFirst();
        assertThat(a.roles()).containsExactly("QA, Engineering", "Product");
        assertThat(a.phases()).containsExactly("Architecture", "Procurement");
        assertThat(r.report().issues()).anyMatch(i -> i.code().equals("AMBIGUOUS_ROLE_DELIMITER") && i.source().equals("C01!G28"));
        assertThat(r.report().issues()).anyMatch(i -> i.code().equals("UNMAPPED_PHASE") && i.source().equals("C01!F28"));
    }
    @Test void treatsAllPhasesAsScopeInsteadOfPhaseName() throws Exception {
        var r = changed(w -> w.getSheet("C01").getRow(27).getCell(5).setCellValue("ALL SDLC phases"));
        var a = r.catalogue().clusters().getFirst().actions().getFirst();
        assertThat(a.allPhases()).isTrue();
        assertThat(a.phases()).isEmpty();
    }
    @Test void blocksCrossClusterActionAndUnexpectedSheet() throws Exception {
        hasError(changed(w -> w.getSheet("C01").getRow(27).getCell(0).setCellValue("C02-A1")), "INVALID_ACTION_ID");
        hasError(changed(w -> w.createSheet("Unreviewed catalogue")), "UNEXPECTED_SHEET");
    }
}
