package org.ethicsaware.catalogue.service;

import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import static org.ethicsaware.catalogue.service.Reasoning.*;

/** Server-only credentials and operator-controlled endpoints; no browser-supplied URLs. */
@Component
public class LlmGateway {
    record Settings(String id,String name,String url,String key,boolean external) {}
    record Result(String text,String request) {}
    private final Environment env;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final JsonMapper json=JsonMapper.builder().build();
    public LlmGateway(Environment env) { this.env=env; }
    Settings settings(String id) {
        return switch(id) {
            case "openai" -> new Settings(id,"OpenAI",env.getProperty("OPENAI_BASE_URL","https://api.openai.com/v1"),env.getProperty("OPENAI_API_KEY",""),true);
            case "anthropic" -> new Settings(id,"Anthropic Claude",env.getProperty("ANTHROPIC_BASE_URL","https://api.anthropic.com/v1"),env.getProperty("ANTHROPIC_API_KEY",""),true);
            case "ollama" -> new Settings(id,"Ollama",env.getProperty("OLLAMA_BASE_URL","http://localhost:11434/v1"),env.getProperty("OLLAMA_API_KEY",""),env.getProperty("OLLAMA_EXTERNAL",Boolean.class,false));
            default -> throw failure(HttpStatus.BAD_REQUEST,"Unknown model provider.");
        };
    }
    public List<Provider> providers() {
        return List.of("openai","anthropic","ollama").stream().map(this::settings).map(s->new Provider(s.id(),s.name(),!s.external()||!s.key().isBlank(),s.external(),s.id().equals("ollama")?"Start Ollama and install a model; use a vision model for diagrams.":"Configure "+s.id().toUpperCase(Locale.ROOT)+"_API_KEY on the server, then restart the application.")).toList();
    }
    public List<String> models(String provider) {
        Settings s=settings(provider); require(s);
        String configured=env.getProperty(provider.toUpperCase(Locale.ROOT)+"_MODELS","");
        if(!configured.isBlank()) return Arrays.stream(configured.split(",")).map(String::strip).filter(v->!v.isBlank()).distinct().toList();
        JsonNode data=exchange(s,"/models"+(provider.equals("anthropic")?"?limit=1000":""),null,Duration.ofSeconds(15));
        List<String> names=new ArrayList<>();
        for(JsonNode item:data.path("data")) {
            String id=item.path("id").asText();
            if(!id.isBlank() && (!provider.equals("openai") || id.matches("^(gpt-|chatgpt-|o[134]).*"))) names.add(id);
        }
        return names.stream().distinct().sorted().toList();
    }
    public Result generate(String provider,String model,String system,String context,List<Map<String,String>> images) {
        Settings s=settings(provider); require(s);
        if(model==null || model.isBlank() || model.length()>200) throw failure(HttpStatus.BAD_REQUEST,"Choose a model.");
        List<Object> content=new ArrayList<>(); content.add(Map.of("type","text","text",context));
        for(var image:images) {
            if(provider.equals("anthropic")) content.add(Map.of("type","image","source",Map.of("type","base64","media_type",image.get("type"),"data",image.get("data"))));
            else content.add(Map.of("type","image_url","image_url",Map.of("url","data:"+image.get("type")+";base64,"+image.get("data"))));
        }
        Map<String,Object> body=new LinkedHashMap<>(); body.put("model",model);
        if(provider.equals("anthropic")) {
            body.put("system",system);body.put("max_tokens",16000);body.put("messages",List.of(Map.of("role","user","content",content)));
        } else {
            body.put("messages",List.of(Map.of("role","system","content",system),Map.of("role","user","content",content)));
            body.put("response_format",Map.of("type","json_object"));
            body.put(provider.equals("openai")?"max_completion_tokens":"max_tokens",provider.equals("ollama")?integerSetting("OLLAMA_MAX_OUTPUT_TOKENS",8192,512,16000):16000);
            if(provider.equals("ollama")) {
                String effort=env.getProperty("OLLAMA_REASONING_EFFORT","low").strip();
                if(!effort.isEmpty()) body.put("reasoning_effort",effort);
            }
        }
        String payload=json.writeValueAsString(body);
        JsonNode response=exchange(s,provider.equals("anthropic")?"/messages":"/chat/completions",payload,Duration.ofSeconds(provider.equals("ollama")?integerSetting("OLLAMA_TIMEOUT_SECONDS",600,1,1800):180));
        String result;
        if(provider.equals("anthropic")) {
            if(!response.path("stop_reason").asText().equals("end_turn")) throw failure(HttpStatus.BAD_GATEWAY,"The model did not complete its proposal. Try a different model or reduce the input.");
            StringBuilder text=new StringBuilder();for(JsonNode block:response.path("content")) if(block.path("type").asText().equals("text")) text.append(block.path("text").asText());result=text.toString();
        } else {
            var choice=response.path("choices").path(0);
            if(!choice.path("finish_reason").asText().equals("stop")) throw failure(HttpStatus.BAD_GATEWAY,"The model did not complete its proposal. Try a different model or reduce the input.");
            result=choice.path("message").path("content").asText();
        }
        if(result.isBlank()) throw failure(HttpStatus.BAD_GATEWAY,"The provider returned no proposal.");
        return new Result(result,payload);
    }
    private int integerSetting(String name,int fallback,int min,int max) {
        try {int value=Integer.parseInt(env.getProperty(name,Integer.toString(fallback)));if(value>=min&&value<=max)return value;}catch(NumberFormatException ignored) {}
        throw failure(HttpStatus.SERVICE_UNAVAILABLE,"Invalid server setting "+name+"; use a value from "+min+" to "+max+".");
    }
    private void require(Settings s) { if(s.external()&&s.key().isBlank()) throw failure(HttpStatus.SERVICE_UNAVAILABLE,"Configure the provider API key on the server before running analysis."); }
    private JsonNode exchange(Settings s,String path,String body,Duration timeout) {
        try {
            var b=HttpRequest.newBuilder(URI.create(s.url().replaceAll("/+$","")+path)).timeout(timeout).header("Content-Type","application/json");
            if(s.id().equals("anthropic")) b.header("x-api-key",s.key()).header("anthropic-version","2023-06-01");
            else if(!s.key().isBlank()) b.header("Authorization","Bearer "+s.key());
            var response=http.send(body==null?b.GET().build():b.POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofInputStream());
            try(var stream=response.body()) {
                if(response.statusCode()<200 || response.statusCode()>=300) throw failure(HttpStatus.BAD_GATEWAY,s.name()+" returned HTTP "+response.statusCode()+". Check server configuration, model access, input compatibility and provider quota.");
                byte[] bytes=stream.readNBytes(2*1024*1024+1);
                if(bytes.length>2*1024*1024) throw failure(HttpStatus.BAD_GATEWAY,"Provider response exceeded the size limit.");
                try {return json.readTree(new String(bytes,StandardCharsets.UTF_8));}
                catch(Exception e) {throw failure(HttpStatus.BAD_GATEWAY,s.name()+" returned unreadable JSON. Check model compatibility and retry.");}
            }
        } catch(ResponseStatusException e) { throw e; }
        catch(HttpTimeoutException e) { throw failure(HttpStatus.GATEWAY_TIMEOUT,s.name()+" did not finish within "+timeout.toSeconds()+" seconds. The endpoint may be reachable but the model is still loading or processing context. Try a shorter conversation or a faster model."+(s.id().equals("ollama")?" Local operators can adjust OLLAMA_TIMEOUT_SECONDS.":"")); }
        catch(InterruptedException e) { Thread.currentThread().interrupt();throw failure(HttpStatus.BAD_GATEWAY,"Model request was interrupted."); }
        catch(Exception e) { throw failure(HttpStatus.BAD_GATEWAY,"Cannot reach "+s.name()+" or read its response. Check the server endpoint and try again."); }
    }
    private ResponseStatusException failure(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
}
