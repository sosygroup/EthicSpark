package org.ethicsaware.catalogue.service;

import org.springframework.stereotype.Component;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.net.URI;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;

/** Server-only operator configuration, deliberately outside workspace exports and reset. */
@Component
public class CompatibleProviderConfig {
    public record Config(String baseUrl,String apiKey,String tokenParameter,int maxTokens,boolean jsonMode,String connectionId) {
        @Override public String toString(){return "Compatible provider configuration [credentials redacted]";}
    }
    public record View(String baseUrl,boolean hasApiKey,String tokenParameter,int maxTokens,boolean jsonMode,String connectionId) {}
    public record Update(String baseUrl,String apiKey,boolean clearApiKey,String tokenParameter,Integer maxTokens,boolean jsonMode) {}
    private final Path file;
    private final JsonMapper json=JsonMapper.builder().build();
    private volatile Config config;
    public CompatibleProviderConfig(Environment env) {
        file=Path.of(env.getProperty("OPENAI_COMPATIBLE_CONFIG_PATH","provider-config/openai-compatible.json")).toAbsolutePath();
        try {
            if(Files.exists(file))config=json.readValue(Files.readString(file),Config.class);
            else {
                String key=env.getProperty("OPENAI_COMPATIBLE_API_KEY","");String url=env.getProperty("OPENAI_COMPATIBLE_BASE_URL",key.isBlank()?"":"https://api.openai.com/v1");
                if(url.isBlank()&&!key.isBlank())url="https://api.openai.com/v1";
                config=new Config(url.replaceAll("/+$",""),key,"max_tokens",4096,false,UUID.randomUUID().toString());
            }
            validate(config);
        } catch(ResponseStatusException e){throw e;}catch(Exception e){throw new IllegalStateException("Cannot read OpenAI-compatible provider configuration. Check the server configuration file.");}
    }
    public Config current(){return config;}
    public View view(){Config c=config;return new View(c.baseUrl(),!c.apiKey().isBlank(),c.tokenParameter(),c.maxTokens(),c.jsonMode(),c.connectionId());}
    public synchronized View save(Update update) {
        if(update==null)throw bad("Provider settings are required.");
        String url=update.baseUrl()==null?"":update.baseUrl().strip().replaceAll("/+$","");
        if(url.isEmpty()&&update.apiKey()!=null&&!update.apiKey().isBlank())url="https://api.openai.com/v1";
        String key=update.clearApiKey()?"":update.apiKey()!=null&&!update.apiKey().isBlank()?update.apiKey().strip():url.equals(config.baseUrl())?config.apiKey():"";
        var next=new Config(url,key,update.tokenParameter()==null?"max_tokens":update.tokenParameter(),update.maxTokens()==null?4096:update.maxTokens(),update.jsonMode(),UUID.randomUUID().toString());validate(next);
        try {
            Files.createDirectories(file.getParent(),PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            Path temporary=Files.createTempFile(file.getParent(),"connection-",".tmp");
            try {Files.setPosixFilePermissions(temporary,PosixFilePermissions.fromString("rw-------"));Files.writeString(temporary,json.writeValueAsString(next));Files.move(temporary,file,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}finally{Files.deleteIfExists(temporary);}
        }catch(Exception e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Cannot save provider settings. Check the backend configuration directory permissions.");}
        config=next;return view();
    }
    private void validate(Config c) {
        if(c.baseUrl()==null||c.baseUrl().length()>2048||c.apiKey()==null||c.apiKey().length()>8192||c.apiKey().chars().anyMatch(ch->ch<32||ch==127))throw bad("Invalid provider URL or API key. Keys must not contain control characters.");
        if(!c.baseUrl().isBlank())try {
            URI uri=URI.create(c.baseUrl());
            if(!List.of("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null)throw new IllegalArgumentException();
            if(uri.getPath().endsWith("/chat/completions")||uri.getPath().endsWith("/models"))throw new IllegalArgumentException();
        }catch(IllegalArgumentException e){throw bad("Enter an HTTP(S) API base URL, including its version/path prefix. Do not include credentials, query parameters, /models or /chat/completions.");}
        if(!List.of("max_tokens","max_completion_tokens","none").contains(c.tokenParameter())||c.maxTokens()<512||c.maxTokens()>16000)throw bad("Choose a supported token parameter and an output limit between 512 and 16000.");
    }
    private ResponseStatusException bad(String text){return new ResponseStatusException(HttpStatus.BAD_REQUEST,text);}
}
