package org.ethicsaware.catalogue.service;

import java.time.Instant;
import java.util.*;

public final class Assistant {
    private Assistant() {}
    public record Project(UUID id,String name,String catalogueVersion) {}
    public record ThreadSummary(UUID id,UUID projectId,String title,int revision,Instant updatedAt) {}
    public record Thread(UUID id,UUID projectId,String title,int revision,List<Message> messages,List<Receipt> receipts) {}
    public record Citation(String clusterId,List<String> actionIds,String rationale) {}
    public record Operation(String id,String kind,String path,String content,String baseSha256,String program,List<String> args,String reason) {}
    public record Artifact(String name,String mediaType,String content) {}
    public record Output(String message,List<Citation> citations,List<String> readFiles,List<Operation> operations,List<Artifact> artifacts) {}
    public record FileContext(String path,String sha256,String text,String notice) {}
    public record Workspace(String name,List<String> tree,List<FileContext> files) {}
    public record Message(UUID id,String role,String text,String status,String provider,String model,Instant at,
                          List<UUID> attachmentIds,List<FileContext> contextManifest,Output output,String inputSha256) {}
    public record Receipt(UUID id,UUID messageId,String operationId,String status,String summary,String output,Integer exitCode,Instant at) {}
    public record CreateProject(String name) {}
    public record CreateThread(UUID projectId) {}
    public record Send(int revision,UUID requestKey,String text,String provider,String model,boolean consent,
                       List<UUID> attachmentIds,Workspace workspace,boolean continuation) {}
    public record Execution(String operationId,String status,String summary,String output,Integer exitCode) {}
}
