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
    public record Metrics(double requestSeconds,Double loadSeconds,Double promptSeconds,Double generationSeconds,Long inputTokens,Long outputTokens,Double tokensPerSecond,Double contextPreparationSeconds) {
        Metrics withPreparation(double seconds) {return new Metrics(requestSeconds,loadSeconds,promptSeconds,generationSeconds,inputTokens,outputTokens,tokensPerSecond,seconds);}
    }
    record Result(String text,String request,Metrics metrics) {}
    public record PrepareRequest(String model,Integer keepAliveMinutes) {
        public PrepareRequest(String model) {this(model,null);}
    }
    public record ThinkingRequest(String model) {}
    public record ThinkingOptions(String model,List<Object> values,Object defaultValue,Object automaticValue,boolean legacyBoolean) {}
    public ThinkingOptions thinkingOptions(ThinkingRequest request) {
        if(request==null||request.model()==null||request.model().isBlank()||request.model().length()>200)throw failure(HttpStatus.BAD_REQUEST,"Choose an Ollama model.");
        String model=request.model().strip();JsonNode info=exchange(nativeOllama(),"/api/show",json.writeValueAsString(Map.of("model",model)),Duration.ofSeconds(15));
        List<Object> values=new ArrayList<>();var advertised=info.path("thinking").path("values");
        boolean legacy=!advertised.isArray() && hasThinkingCapability(info);
        if(advertised.isArray())for(JsonNode value:advertised) {if(value.isBoolean()) values.add(value.asBoolean());else if(value.isString()&&!value.asText().isBlank()&&value.asText().length()<=100)values.add(value.asText());}
        else if(legacy)values.addAll(List.of(true,false));
        var defaults=info.path("thinking").path("default");Object defaultValue=defaults.isBoolean()?defaults.asBoolean():defaults.isString()?defaults.asText():null;
        Map<String,Object> body=new LinkedHashMap<>();Object preferred=effortValue(env.getProperty("OLLAMA_REASONING_EFFORT","low").strip());
        if(!preferred.equals("")) configureThinking(body,info,preferred);
        return new ThinkingOptions(model,values.stream().distinct().toList(),defaultValue,body.get("think"),legacy);
    }
    public static void validateThinkingPreference(Object value) {
        if(value!=null && !(value instanceof Boolean) && !(value instanceof String text && text.length()<=100))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ollama reasoning must be a supported level, a boolean or an empty string for model default.");
    }
    public record UnloadRequest(String model) {}
    public record Unloaded(String model,boolean unloaded) {}
    private final java.util.concurrent.ConcurrentHashMap<String,java.util.concurrent.locks.ReentrantReadWriteLock> modelLocks=new java.util.concurrent.ConcurrentHashMap<>();
    private java.util.concurrent.locks.ReentrantReadWriteLock modelLock(String model) {return modelLocks.computeIfAbsent(model,k->new java.util.concurrent.locks.ReentrantReadWriteLock());}
    private String installedModel(String value) {
        if(value==null||value.isBlank()||value.length()>200)throw failure(HttpStatus.BAD_REQUEST,"Choose an installed Ollama model.");
        String model=value.strip();if(!models("ollama").contains(model))throw failure(HttpStatus.BAD_REQUEST,"Choose an exact installed model ID. Load available models first.");return model;
    }
    public Unloaded unload(UnloadRequest request) {
        String model=installedModel(request==null?null:request.model());var lock=modelLock(model).writeLock();
        if(!lock.tryLock())throw failure(HttpStatus.CONFLICT,"The model is preparing or answering a request. Wait before unloading it.");
        try {
            JsonNode response=exchange(nativeOllama(),"/api/generate",json.writeValueAsString(Map.of("model",model,"stream",false,"keep_alive",0)),Duration.ofSeconds(30));
            if(!response.path("done").asBoolean()||!response.path("done_reason").asText().equals("unload"))throw failure(HttpStatus.BAD_GATEWAY,"Ollama did not confirm model unloading.");
            return new Unloaded(model,true);
        }finally{lock.unlock();}
    }
    public record Preparation(String model,int keepAliveMinutes,double requestSeconds,Double loadSeconds) {}
    private final java.util.concurrent.ConcurrentHashMap<String,java.util.concurrent.CompletableFuture<Preparation>> preparations=new java.util.concurrent.ConcurrentHashMap<>();
    private static double seconds(long nanos) {return nanos/1_000_000_000.0;}
    private static Double duration(JsonNode node,String name) {return node.has(name)&&node.path(name).isNumber()&&node.path(name).asDouble()>=0?node.path(name).asDouble()/1_000_000_000.0:null;}
    private static Long count(JsonNode node,String name) {return node.has(name)&&node.path(name).isNumber()&&node.path(name).asLong()>=0?node.path(name).asLong():null;}
    private int keepAliveMinutes(Integer requested) {
        if(requested==null)return integerSetting("OLLAMA_KEEP_ALIVE_MINUTES",30,1,240);
        if(requested<1||requested>240)throw failure(HttpStatus.BAD_REQUEST,"Keep model in memory must be between 1 and 240 minutes.");return requested;
    }
    private Settings nativeOllama() {
        Settings s=settings("ollama");require(s);
        String base=s.url().replaceAll("/+$","").replaceFirst("/v1$","");
        return new Settings(s.id(),s.name(),base,s.key(),s.external());
    }
    public Preparation prepare(PrepareRequest request) {
        if(request==null||request.model()==null||request.model().isBlank()||request.model().length()>200)throw failure(HttpStatus.BAD_REQUEST,"Choose an installed Ollama model.");
        String model=request.model().strip();
        int minutes=keepAliveMinutes(request.keepAliveMinutes());String key=model+":"+minutes;
        var pending=new java.util.concurrent.CompletableFuture<Preparation>();
        var existing=preparations.putIfAbsent(key,pending);
        if(existing!=null) {try{return existing.join();}catch(java.util.concurrent.CompletionException e){if(e.getCause() instanceof RuntimeException r)throw r;throw e;}}
        var lock=modelLock(model).readLock();lock.lock();
        try {
            long start=System.nanoTime();
            if(!models("ollama").contains(model))throw failure(HttpStatus.BAD_REQUEST,"Choose an exact installed model ID. Load available models first.");
            JsonNode response=exchange(nativeOllama(),"/api/generate",json.writeValueAsString(Map.of("model",model,"stream",false,"keep_alive",minutes*60)),Duration.ofSeconds(integerSetting("OLLAMA_TIMEOUT_SECONDS",600,1,1800)));
            if(!response.path("done").asBoolean())throw failure(HttpStatus.BAD_GATEWAY,"Ollama did not confirm model preparation.");
            var result=new Preparation(model,minutes,seconds(System.nanoTime()-start),duration(response,"load_duration"));pending.complete(result);return result;
        }catch(RuntimeException e){pending.completeExceptionally(e);throw e;}finally{preparations.remove(key,pending);lock.unlock();}
    }
    private final CompatibleProviderConfig compatible;
    private final Environment env;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final JsonMapper json=JsonMapper.builder().build();
    public LlmGateway(Environment env) {this(env,new CompatibleProviderConfig(env));}
    @org.springframework.beans.factory.annotation.Autowired
    public LlmGateway(Environment env,CompatibleProviderConfig compatible) {this.env=env;this.compatible=compatible;}
    Settings settings(String id) {
        return switch(id) {
            case "compatible" -> {var c=compatible.current();yield new Settings(id,"OpenAI-compatible",c.baseUrl(),c.apiKey(),true);}
            case "openai" -> new Settings(id,"OpenAI",env.getProperty("OPENAI_BASE_URL","https://api.openai.com/v1"),env.getProperty("OPENAI_API_KEY",""),true);
            case "anthropic" -> new Settings(id,"Anthropic Claude",env.getProperty("ANTHROPIC_BASE_URL","https://api.anthropic.com/v1"),env.getProperty("ANTHROPIC_API_KEY",""),true);
            case "ollama" -> new Settings(id,"Ollama",env.getProperty("OLLAMA_BASE_URL","http://localhost:11434/v1"),env.getProperty("OLLAMA_API_KEY",""),env.getProperty("OLLAMA_EXTERNAL",Boolean.class,false));
            default -> throw failure(HttpStatus.BAD_REQUEST,"Unknown model provider.");
        };
    }
    public List<Provider> providers() {
        var result=new ArrayList<Provider>();
        for(String id:List.of("openai","compatible","anthropic","ollama")) {
            var s=settings(id);boolean custom=id.equals("compatible");
            result.add(new Provider(s.id(),s.name(),custom?!s.url().isBlank():!s.external()||!s.key().isBlank(),s.external(),custom?"Enter an API base URL and an optional provider API key in Model settings.":id.equals("ollama")?"Start Ollama and install a model; use a vision model for diagrams.":"Configure "+id.toUpperCase(Locale.ROOT)+"_API_KEY on the server, then restart the application.",custom?compatible.current().connectionId():""));
        }
        return result;
    }
    public List<String> models(String provider) {
        Settings s=settings(provider); require(s);
        String configured=env.getProperty((provider.equals("compatible")?"OPENAI_COMPATIBLE":provider.toUpperCase(Locale.ROOT))+"_MODELS","");
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
        return generate(provider,model,system,context,images,null);
    }
    public Result generate(String provider,String model,String system,String context,List<Map<String,String>> images,Integer retention) {
        return generate(provider,model,system,context,images,retention,null);
    }
    public Result generate(String provider,String model,String system,String context,List<Map<String,String>> images,Integer retention,Object thinkingPreference) {
        return generate(provider,model,system,context,images,retention,thinkingPreference,null);
    }
    public void validateConnection(String provider,String connectionId) {
        if("compatible".equals(provider)&&!compatible.current().connectionId().equals(connectionId))throw failure(HttpStatus.CONFLICT,"The OpenAI-compatible connection changed. Reopen Model settings and authorise the current connection before sending project material.");
    }
    public Result generate(String provider,String model,String system,String context,List<Map<String,String>> images,Integer retention,Object thinkingPreference,String connectionId) {
        validateThinkingPreference(thinkingPreference);
        var custom=provider.equals("compatible")?compatible.current():null;
        if(custom!=null&&connectionId!=null&&!custom.connectionId().equals(connectionId))throw failure(HttpStatus.CONFLICT,"The provider connection changed. Reload Model settings and authorise it again.");
        Settings s=custom==null?settings(provider):new Settings("compatible","OpenAI-compatible",custom.baseUrl(),custom.apiKey(),true); require(s);
        if(model==null || model.isBlank() || model.length()>200) throw failure(HttpStatus.BAD_REQUEST,"Choose a model.");
        if(provider.equals("ollama")) {
            var lock=modelLock(model.strip()).readLock();lock.lock();
            try{return generateOllama(model,system,context,images,keepAliveMinutes(retention),thinkingPreference);}finally{lock.unlock();}
        }
        List<Object> content=new ArrayList<>(); content.add(Map.of("type","text","text",context));
        for(var image:images) {
            if(provider.equals("anthropic")) content.add(Map.of("type","image","source",Map.of("type","base64","media_type",image.get("type"),"data",image.get("data"))));
            else content.add(Map.of("type","image_url","image_url",Map.of("url","data:"+image.get("type")+";base64,"+image.get("data"))));
        }
        Map<String,Object> body=new LinkedHashMap<>(); body.put("model",model);
        if(provider.equals("anthropic")) {
            body.put("system",system);body.put("max_tokens",16000);body.put("messages",List.of(Map.of("role","user","content",content)));
        } else {
            body.put("messages",List.of(Map.of("role","system","content",system),Map.of("role","user","content",custom!=null&&images.isEmpty()?context:content)));
            if(custom==null||custom.jsonMode())body.put("response_format",Map.of("type","json_object"));
            if(custom==null)body.put("max_completion_tokens",16000);
            else if(!custom.tokenParameter().equals("none"))body.put(custom.tokenParameter(),custom.maxTokens());
        }
        String payload=json.writeValueAsString(body);
        long started=System.nanoTime();
        JsonNode response=exchange(s,provider.equals("anthropic")?"/messages":"/chat/completions",payload,Duration.ofSeconds(180));
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
        return new Result(result,custom==null?payload:json.writeValueAsString(Map.of("endpoint",s.url(),"connectionId",custom.connectionId(),"body",body)),new Metrics(seconds(System.nanoTime()-started),null,null,null,count(response.path("usage"),provider.equals("anthropic")?"input_tokens":"prompt_tokens"),count(response.path("usage"),provider.equals("anthropic")?"output_tokens":"completion_tokens"),null,null));
    }
    private Result generateOllama(String model,String system,String context,List<Map<String,String>> images,int minutes,Object thinkingPreference) {
        Map<String,Object> user=new LinkedHashMap<>();user.put("role","user");user.put("content",context);
        if(!images.isEmpty())user.put("images",images.stream().map(i->i.get("data")).toList());
        Map<String,Object> body=new LinkedHashMap<>();body.put("model",model);body.put("messages",List.of(Map.of("role","system","content",system),user));
        body.put("stream",false);body.put("format","json");body.put("keep_alive",minutes*60);
        body.put("options",Map.of("num_predict",integerSetting("OLLAMA_MAX_OUTPUT_TOKENS",8192,512,16000)));
        Object effort=thinkingPreference==null?effortValue(env.getProperty("OLLAMA_REASONING_EFFORT","low").strip()):thinkingPreference instanceof String text?text.strip():thinkingPreference;
        if(!effort.equals("")) {
            JsonNode info=exchange(nativeOllama(),"/api/show",json.writeValueAsString(Map.of("model",model)),Duration.ofSeconds(15));
            configureThinking(body,info,effort);
        }
        String payload=json.writeValueAsString(body);long started=System.nanoTime();
        JsonNode response=exchange(nativeOllama(),"/api/chat",payload,Duration.ofSeconds(integerSetting("OLLAMA_TIMEOUT_SECONDS",600,1,1800)));
        if(!response.path("done").asBoolean()||!response.path("done_reason").asText().equals("stop"))throw failure(HttpStatus.BAD_GATEWAY,"The model did not complete its proposal. Try a different model or reduce the input.");
        String text=response.path("message").path("content").asText();if(text.isBlank())throw failure(HttpStatus.BAD_GATEWAY,"The provider returned no proposal.");
        Double generation=duration(response,"eval_duration");Long output=count(response,"eval_count");
        return new Result(text,payload,new Metrics(seconds(System.nanoTime()-started),duration(response,"load_duration"),duration(response,"prompt_eval_duration"),generation,count(response,"prompt_eval_count"),output,generation!=null&&generation>0&&output!=null?output/generation:null,null));
    }
    /** Treat effort as a preference: unsupported controls are omitted, keeping the selected model's default. */
    private static Object effortValue(String effort) {return effort.equals("none")||effort.equals("false")?Boolean.FALSE:effort.equals("true")?Boolean.TRUE:effort;}
    private static boolean hasThinkingCapability(JsonNode info) {for(JsonNode value:info.path("capabilities"))if(value.asText().equals("thinking"))return true;return false;}
    private static void configureThinking(Map<String,Object> body,JsonNode info,Object requested) {
        JsonNode values=info.path("thinking").path("values");
        if(values.isArray()) {
            for(JsonNode value:values) {
                if(requested instanceof Boolean bool && value.isBoolean() && value.asBoolean()==bool || requested instanceof String level && value.isString() && value.asText().equals(level)) {
                    body.put("think",requested);return;
                }
            }
            return; // Includes unsupported levels, booleans and models advertising no usable control.
        }
        if(hasThinkingCapability(info)) body.put("think",!Boolean.FALSE.equals(requested)); // Older boolean-only metadata.
    }
    private ResponseStatusException providerFailure(Settings provider,int status) {
        String prefix=provider.name()+" returned HTTP "+status+". ";
        String credential=provider.id().equals("compatible")?"provider API key in Model settings":provider.id().toUpperCase(Locale.ROOT)+"_API_KEY";
        String detail=switch(status) {
            case 401 -> "Authentication was rejected. Check the active "+credential+" on the backend, its organization/project and any access-policy or IP restrictions. "+(provider.id().equals("compatible")?"Save corrected connection settings; no restart is required.":"After changing credentials, restart the application service.")+" Do not share the key in chat.";
            case 403 -> "Access was denied. Check this account's permissions, model access and applicable access policies.";
            case 429 -> "A request-rate, credit or usage limit was reached. Check the provider's limits and billing before retrying; repeated retries do not resolve exhausted credits.";
            case 400,422 -> "The provider rejected the request format or options. Check input and model compatibility.";
            case 404 -> "The endpoint or requested model was not found. Check the configured endpoint and exact model ID.";
            default -> status>=500?"The provider could not process the request. It may be temporarily unavailable; retry later and check its service status.":"The provider rejected the request. Check the server configuration and provider access.";
        };
        return failure(HttpStatus.BAD_GATEWAY,prefix+detail);
    }
    private int integerSetting(String name,int fallback,int min,int max) {
        try {int value=Integer.parseInt(env.getProperty(name,Integer.toString(fallback)));if(value>=min&&value<=max)return value;}catch(NumberFormatException ignored) {}
        throw failure(HttpStatus.SERVICE_UNAVAILABLE,"Invalid server setting "+name+"; use a value from "+min+" to "+max+".");
    }
    private void require(Settings s) { if(s.id().equals("compatible")){if(s.url().isBlank())throw failure(HttpStatus.SERVICE_UNAVAILABLE,"Configure the OpenAI-compatible API base URL in Model settings first.");return;} if(s.external()&&s.key().isBlank()) throw failure(HttpStatus.SERVICE_UNAVAILABLE,"Configure the provider API key on the server before running analysis."); }
    private JsonNode exchange(Settings s,String path,String body,Duration timeout) {
        try {
            var b=HttpRequest.newBuilder(URI.create(s.url().replaceAll("/+$","")+path)).timeout(timeout).header("Content-Type","application/json");
            if(s.id().equals("anthropic")) b.header("x-api-key",s.key()).header("anthropic-version","2023-06-01");
            else if(!s.key().isBlank()) b.header("Authorization","Bearer "+s.key());
            var response=http.send(body==null?b.GET().build():b.POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofInputStream());
            try(var stream=response.body()) {
                if(response.statusCode()<200 || response.statusCode()>=300) throw providerFailure(s,response.statusCode());
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
