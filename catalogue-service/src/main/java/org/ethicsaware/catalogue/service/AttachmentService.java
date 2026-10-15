package org.ethicsaware.catalogue.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.ethicsaware.catalogue.core.WorkbookImporter;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.time.Instant;
import java.util.*;

@Service
public class AttachmentService {
    public record Attachment(UUID id,String fieldId,String name,String mediaType,int size,String sha256,String text,String extraction,Instant at) {}
    private final JdbcTemplate db;
    private final JsonMapper json=JsonMapper.builder().build();
    public AttachmentService(JdbcTemplate db) { this.db=db; }
    public List<Attachment> list(UUID project) {
        return db.query("SELECT document::text FROM profile_attachment WHERE project_id=? ORDER BY created_at,id",(rs,n)->json.readValue(rs.getString(1),Attachment.class),project);
    }
    public Attachment get(UUID project,UUID id) {
        return db.query("SELECT document::text FROM profile_attachment WHERE project_id=? AND id=?",(rs,n)->json.readValue(rs.getString(1),Attachment.class),project,id)
                .stream().findFirst().orElseThrow(()->bad(HttpStatus.NOT_FOUND,"Attachment not found in this project."));
    }
    public byte[] bytes(UUID project,UUID id) {
        get(project,id); return db.queryForObject("SELECT content FROM profile_attachment WHERE project_id=? AND id=?",byte[].class,project,id);
    }
    public void validate(UUID project,String field,List<UUID> ids) {
        if(ids.size()>10 || new HashSet<>(ids).size()!=ids.size()) throw bad(HttpStatus.BAD_REQUEST,"Use at most ten different files per field.");
        for(UUID id:ids) if(id==null || !get(project,id).fieldId().equals(field)) throw bad(HttpStatus.BAD_REQUEST,"Attachment belongs to another profile field.");
    }
    @Transactional public Attachment upload(UUID project,String field,MultipartFile file) {
        if(!Workflow.FIELD_IDS.contains(field) && !field.equals("company_ethics")) throw bad(HttpStatus.BAD_REQUEST,"Invalid attachment field.");
        // Lock the owning row so concurrent uploads cannot bypass the quota.
        if(db.query("SELECT id FROM workflow_project WHERE id=? FOR UPDATE",(rs,n)->rs.getObject(1,UUID.class),project).isEmpty()) throw bad(HttpStatus.NOT_FOUND,"Project not found.");
        var existing=list(project);
        if(existing.size()>=50 || existing.stream().mapToLong(Attachment::size).sum()+file.getSize()>100L*1024*1024) throw bad(HttpStatus.BAD_REQUEST,"Project attachment limit reached (50 files / 100 MiB).");
        if(file.isEmpty() || file.getSize()>10*1024*1024) throw bad(HttpStatus.BAD_REQUEST,"Each file must be nonempty and at most 10 MiB.");
        String name=Optional.ofNullable(file.getOriginalFilename()).orElse("attachment").replaceAll("[\\p{Cntrl}/\\\\]","_");
        if(name.length()>180) name=name.substring(name.length()-180);
        byte[] bytes; String text="",type="application/octet-stream",extraction="Stored only: this format is not read by the model.";
        try {
            bytes=file.getBytes(); String lower=name.toLowerCase(Locale.ROOT);
            if(lower.endsWith(".pdf")) {
                type="application/pdf";
                try(var pdf=Loader.loadPDF(bytes)) {
                    if(pdf.getNumberOfPages()>200) throw bad(HttpStatus.BAD_REQUEST,"PDFs must contain at most 200 pages.");
                    text=new PDFTextStripper().getText(pdf);
                }
            } else if(lower.endsWith(".docx")) {
                type="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                try(var doc=new XWPFDocument(new ByteArrayInputStream(bytes));var extractor=new XWPFWordExtractor(doc)) { text=extractor.getText(); }
            } else if(lower.matches(".*\\.(txt|md|csv|json|xml|yaml|yml|log|java|ts|js|html|sql|puml|mmd)$")) {
                text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
                if(text.indexOf('\0')>=0) throw bad(HttpStatus.BAD_REQUEST,"Text attachments must contain UTF-8 text, without binary content.");
                type="text/plain";
            } else if(lower.matches(".*\\.(png|jpg|jpeg|webp)$")) {
                boolean png=bytes.length>8 && bytes[0]==(byte)137 && bytes[1]==80 && bytes[2]==78 && bytes[3]==71;
                boolean jpg=bytes.length>3 && bytes[0]==(byte)255 && bytes[1]==(byte)216 && bytes[2]==(byte)255;
                boolean webp=bytes.length>12 && new String(bytes,0,4,StandardCharsets.US_ASCII).equals("RIFF") && new String(bytes,8,4,StandardCharsets.US_ASCII).equals("WEBP");
                if(!png&&!jpg&&!webp) throw bad(HttpStatus.BAD_REQUEST,"Image contents do not match a supported PNG, JPEG or WebP file.");
                type=png?"image/png":jpg?"image/jpeg":"image/webp";
                extraction="Image: requires a vision-capable model.";
            }
            if(!type.equals("application/octet-stream") && !type.startsWith("image/")) extraction=text.isBlank()?"No text extracted: scanned or empty document; OCR is not available.":"Text extracted.";
            if(text.length()>50000) { text=text.substring(0,50000); extraction="Text truncated to 50,000 characters; remaining content is not sent to the model."; }
        } catch(ResponseStatusException e) { throw e; }
        catch(Exception e) { throw bad(HttpStatus.BAD_REQUEST,"The file could not be read. Use a valid, unencrypted PDF/DOCX or UTF-8 text file."); }
        Attachment a=new Attachment(UUID.randomUUID(),field,name,type,bytes.length,WorkbookImporter.sha256(bytes),text,extraction,Instant.now());
        db.update("INSERT INTO profile_attachment(id,project_id,field_id,document,content) VALUES (?,?,?,CAST(? AS jsonb),?)",a.id(),project,field,json.writeValueAsString(a),bytes);
        return a;
    }
    private ResponseStatusException bad(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
}
