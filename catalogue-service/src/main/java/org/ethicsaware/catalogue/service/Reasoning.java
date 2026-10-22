package org.ethicsaware.catalogue.service;

import java.time.Instant;
import java.util.*;
import static org.ethicsaware.catalogue.service.Workflow.*;

public final class Reasoning {
    private Reasoning() {}
    public record Provider(String id,String name,boolean configured,boolean external,String setup,String connectionId) {
        public Provider(String id,String name,boolean configured,boolean external,String setup){this(id,name,configured,external,setup,"");}
    }
    public record Request(int revision,String actor,String provider,String model,boolean consent,String providerConnectionId) {
        public Request(int revision,String actor,String provider,String model,boolean consent){this(revision,actor,provider,model,consent,null);}
    }
    public record Mapping(String card,String characteristic) {}
    public record ClusterProposal(String clusterId,String rationale,List<Mapping> mappings) {}
    public record Output(List<ClusterProposal> clusters,List<Recommendation> recommendations,List<String> uncertainties) {}
    public record Run(UUID id,int revision,int profileVersion,String catalogueVersion,String provider,String model,
                      String promptVersion,Instant at,String inputSha256,String outputSha256,Output output) {}
    public record Apply(int revision,String actor,UUID runId,List<ClusterProposal> clusters) {}
}
