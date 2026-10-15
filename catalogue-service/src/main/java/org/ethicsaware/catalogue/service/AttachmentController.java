package org.ethicsaware.catalogue.service;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@RequestMapping("/api/projects/{project}/attachments")
public class AttachmentController {
    private final AttachmentService files;
    private final WorkflowService projects;
    public AttachmentController(AttachmentService files,WorkflowService projects) { this.files=files;this.projects=projects; }
    @GetMapping public List<AttachmentService.Attachment> list(@PathVariable UUID project) { projects.get(project);return files.list(project); }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentService.Attachment upload(@PathVariable UUID project,@RequestParam String field,@RequestParam MultipartFile file) { return files.upload(project,field,file); }
    @GetMapping("/{id}") public ResponseEntity<byte[]> download(@PathVariable UUID project,@PathVariable UUID id) {
        var a=files.get(project,id);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(a.name(),java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options","nosniff").body(files.bytes(project,id));
    }
}
