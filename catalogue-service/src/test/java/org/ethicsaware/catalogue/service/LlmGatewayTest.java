package org.ethicsaware.catalogue.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;

class LlmGatewayTest {
    static final JsonMapper JSON=JsonMapper.builder().build();
    @Test void compatibleTransportSupportsArbitraryModelsOptionalKeysAndDoesNotChangeOfficialOpenAI() throws Exception {
        var directory=java.nio.file.Files.createTempDirectory("compatible-transport-");
        var body=new AtomicReference<String>();var auth=new AtomicReference<String>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/custom/v1/models",e->{auth.set(e.getRequestHeaders().getFirst("Authorization"));byte[] bytes="{\"data\":[{\"id\":\"vendor/model-name\"},{\"id\":\"other-model\"},{\"id\":\"gpt-test\"}]}".getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});
        server.createContext("/custom/v1/chat/completions",e->{auth.set(e.getRequestHeaders().getFirst("Authorization"));body.set(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));byte[] bytes="{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"{}\"}}]}".getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
        try {
            String base="http://127.0.0.1:"+server.getAddress().getPort()+"/custom/v1";
            var env=new MockEnvironment().withProperty("OPENAI_COMPATIBLE_CONFIG_PATH",directory.resolve("provider.json").toString()).withProperty("OPENAI_BASE_URL",base).withProperty("OPENAI_API_KEY","official-test-key");
            var config=new CompatibleProviderConfig(env);config.save(new CompatibleProviderConfig.Update(base,"vendor-key",false,"max_tokens",2048,false));var gateway=new LlmGateway(env,config);
            assertThat(gateway.models("compatible")).containsExactly("gpt-test","other-model","vendor/model-name");assertThat(auth.get()).isEqualTo("Bearer vendor-key");
            var result=gateway.generate("compatible","vendor/model-name","system","context",List.of());var sent=JSON.readTree(body.get());
            assertThat(sent.path("max_tokens").asInt()).isEqualTo(2048);assertThat(sent.has("max_completion_tokens")).isFalse();assertThat(sent.has("response_format")).isFalse();assertThat(sent.path("messages").get(1).path("content").asText()).isEqualTo("context");assertThat(result.request()).contains(base).doesNotContain("vendor-key");
            config.save(new CompatibleProviderConfig.Update(base,null,true,"max_completion_tokens",1024,true));
            gateway.generate("compatible","other-model","system","context",List.of(java.util.Map.of("type","image/png","data","aGVsbG8=")));
            sent=JSON.readTree(body.get());assertThat(auth.get()).isNull();assertThat(sent.path("max_completion_tokens").asInt()).isEqualTo(1024);assertThat(sent.path("response_format").path("type").asText()).isEqualTo("json_object");assertThat(sent.path("messages").get(1).path("content").get(1).path("image_url").path("url").asText()).isEqualTo("data:image/png;base64,aGVsbG8=");
            config.save(new CompatibleProviderConfig.Update(base,null,true,"none",4096,false));gateway.generate("compatible","other-model","system","context",List.of());sent=JSON.readTree(body.get());assertThat(sent.has("max_tokens")).isFalse();assertThat(sent.has("max_completion_tokens")).isFalse();
            assertThat(gateway.models("openai")).containsExactly("gpt-test");gateway.generate("openai","gpt-test","system","context",List.of());sent=JSON.readTree(body.get());assertThat(auth.get()).isEqualTo("Bearer official-test-key");assertThat(sent.path("max_completion_tokens").asInt()).isEqualTo(16000);assertThat(sent.path("response_format").path("type").asText()).isEqualTo("json_object");
        }finally{server.stop(0);try(var paths=java.nio.file.Files.walk(directory)){for(var path:paths.sorted(java.util.Comparator.reverseOrder()).toList())java.nio.file.Files.deleteIfExists(path);}}
    }
    @Test void localModelUsesItsOwnOutputAndThinkingSettings() throws Exception {
        var body=new AtomicReference<String>();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/api/show",exchange->{byte[] bytes="{\"capabilities\":[\"thinking\"],\"thinking\":{\"values\":[false,\"low\",\"medium\"]}}".getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();});
        server.createContext("/api/chat",exchange->{
            body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            byte[] bytes="{\"done\":true,\"done_reason\":\"stop\",\"message\":{\"content\":\"{}\"},\"load_duration\":1000000000,\"prompt_eval_duration\":2000000000,\"eval_duration\":4000000000,\"prompt_eval_count\":100,\"eval_count\":20}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });server.start();
        try {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1");
            var result=new LlmGateway(env).generate("ollama","local-test","system","context",List.of(java.util.Map.of("type","image/png","data","aGVsbG8=")));assertThat(result.text()).isEqualTo("{}");
            assertThat(result.metrics().loadSeconds()).isEqualTo(1);assertThat(result.metrics().promptSeconds()).isEqualTo(2);assertThat(result.metrics().generationSeconds()).isEqualTo(4);assertThat(result.metrics().tokensPerSecond()).isEqualTo(5);assertThat(result.metrics().inputTokens()).isEqualTo(100);
            assertThat(result.request()).contains("aGVsbG8=","system","context");
            var sent=JSON.readTree(body.get());assertThat(sent.path("options").path("num_predict").asInt()).isEqualTo(8192);assertThat(sent.path("think").asText()).isEqualTo("low");
            assertThat(sent.path("keep_alive").asInt()).isEqualTo(1800);assertThat(sent.path("stream").asBoolean()).isFalse();assertThat(sent.path("format").asText()).isEqualTo("json");assertThat(sent.path("messages").path(1).path("images").path(0).asText()).isEqualTo("aGVsbG8=");
            env.withProperty("OLLAMA_REASONING_EFFORT","").withProperty("OLLAMA_MAX_OUTPUT_TOKENS","4096");new LlmGateway(env).generate("ollama","local-test","system","context",List.of(),7);
            sent=JSON.readTree(body.get());assertThat(sent.path("keep_alive").asInt()).isEqualTo(420);assertThat(sent.has("think")).isFalse();assertThat(sent.path("options").path("num_predict").asInt()).isEqualTo(4096);
        } finally {server.stop(0);}
    }
    @Test void thinkingPreferencesOnlySendAdvertisedControlsAndNeverSwitchModels() throws Exception {
        record Case(String effort,String metadata,Object expected) {}
        var metadata=new AtomicReference<String>();var body=new AtomicReference<String>();var calls=new java.util.concurrent.atomic.AtomicInteger();var shows=new java.util.concurrent.atomic.AtomicInteger();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/api/show",e->{shows.incrementAndGet();byte[] bytes=metadata.get().getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});
        server.createContext("/api/chat",e->{calls.incrementAndGet();body.set(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));byte[] bytes="{\"done\":true,\"done_reason\":\"stop\",\"message\":{\"content\":\"{}\"}}".getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
        try {
            String named="{\"capabilities\":[\"thinking\"],\"thinking\":{\"values\":[\"medium\",\"high\"],\"default\":\"medium\"}}";
            var cases=List.of(new Case("low",named,null),new Case("high",named,"high"),new Case("true",named,null),new Case("none",named,null),
                new Case("false","{\"thinking\":{\"values\":[false]}}",false),new Case("true","{\"thinking\":{\"values\":[true,false]}}",true),
                new Case("low","{\"thinking\":{\"values\":[true,false]}}",null),new Case("low","{\"capabilities\":[\"thinking\"]}",true),
                new Case("none","{\"capabilities\":[\"thinking\"]}",false),new Case("low","{\"capabilities\":[\"completion\"]}",null),new Case("",named,null));
            int index=0;
            for(var sample:cases) {
                metadata.set(sample.metadata());var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OLLAMA_REASONING_EFFORT",sample.effort());
                var result=new LlmGateway(env).generate("ollama","selected-model","system","context",List.of());
                var sent=JSON.readTree(body.get());assertThat(sent.path("model").asText()).isEqualTo("selected-model");assertThat(result.text()).isEqualTo("{}");
                if(sample.expected()==null)assertThat(sent.has("think")).isFalse();
                else if(sample.expected() instanceof Boolean bool) {assertThat(sent.path("think").isBoolean()).isTrue();assertThat(sent.path("think").asBoolean()).isEqualTo(bool);}
                else assertThat(sent.path("think").asText()).isEqualTo(sample.expected());
                assertThat(calls.get()).isEqualTo(++index);
            }
            assertThat(shows.get()).isEqualTo(cases.size()-1);
            metadata.set(named);var configured=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OLLAMA_REASONING_EFFORT","low");var gateway=new LlmGateway(configured);
            var options=gateway.thinkingOptions(new LlmGateway.ThinkingRequest("selected-model"));assertThat(options.values()).containsExactly("medium","high");assertThat(options.defaultValue()).isEqualTo("medium");assertThat(options.automaticValue()).isNull();
            gateway.generate("ollama","selected-model","system","context",List.of(),30,"high");assertThat(JSON.readTree(body.get()).path("think").asText()).isEqualTo("high");
            gateway.generate("ollama","selected-model","system","context",List.of(),30,"");assertThat(JSON.readTree(body.get()).has("think")).isFalse();
            gateway.generate("ollama","selected-model","system","context",List.of(),30,true);assertThat(JSON.readTree(body.get()).has("think")).isFalse();
            for(Object invalid:List.of(12,java.util.Map.of("level","high"),"x".repeat(101)))assertThatThrownBy(()->gateway.generate("ollama","selected-model","system","context",List.of(),30,invalid)).isInstanceOf(ResponseStatusException.class);

        }finally{server.stop(0);}
    }
    @Test void providerHttpFailuresExplainAuthenticationAndLimitsWithoutExposingResponseBodies() throws Exception {
        var status=new java.util.concurrent.atomic.AtomicInteger(401);var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/v1/chat/completions",e->{byte[] bytes="{\"error\":\"private-provider-body-do-not-echo\"}".getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(status.get(),bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
        try {
            var env=new MockEnvironment().withProperty("OPENAI_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OPENAI_API_KEY","local-test-credential");var gateway=new LlmGateway(env);
            for(int code:List.of(401,403,429,400,404,503)) {
                status.set(code);
                assertThatThrownBy(()->gateway.generate("openai","stub-model","system","context",List.of())).isInstanceOfSatisfying(ResponseStatusException.class,e->{
                    assertThat(e.getStatusCode().value()).isEqualTo(502);assertThat(e.getReason()).contains("HTTP "+code).doesNotContain("private-provider-body","local-test-credential");
                    if(code==401)assertThat(e.getReason()).contains("Authentication was rejected","OPENAI_API_KEY").doesNotContain("quota");
                    if(code==403)assertThat(e.getReason()).contains("Access was denied");
                    if(code==429)assertThat(e.getReason()).contains("limit was reached");
                });
            }
        }finally{server.stop(0);}
    }
    @Test void timeoutReportsSlowProcessingSeparatelyFromConnectionFailure() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/api/chat",exchange->{try{Thread.sleep(1500);}catch(InterruptedException e){Thread.currentThread().interrupt();}finally{exchange.close();}});server.start();
        try {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OLLAMA_TIMEOUT_SECONDS","1").withProperty("OLLAMA_REASONING_EFFORT","");
            assertThatThrownBy(()->new LlmGateway(env).generate("ollama","local-test","system","context",List.of()))
                .isInstanceOfSatisfying(ResponseStatusException.class,e->{assertThat(e.getStatusCode().value()).isEqualTo(504);assertThat(e.getReason()).contains("within 1 seconds","still loading or processing context").doesNotContain("Cannot reach");});
        } finally {server.stop(0);}
    }

    @Test void preparationOnlyLoadsAnInstalledModelAndUsesConfiguredRetention() throws Exception {
        var body=new AtomicReference<String>();var calls=new java.util.concurrent.atomic.AtomicInteger();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/api/generate",exchange->{calls.incrementAndGet();body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));byte[] bytes="{\"done\":true,\"load_duration\":2500000000}".getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();});server.start();
        try {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1/").withProperty("OLLAMA_MODELS","installed-model").withProperty("OLLAMA_KEEP_ALIVE_MINUTES","45");
            var gateway=new LlmGateway(env);var result=gateway.prepare(new LlmGateway.PrepareRequest("installed-model"));
            assertThat(result.keepAliveMinutes()).isEqualTo(45);assertThat(result.loadSeconds()).isEqualTo(2.5);
            var sent=JSON.readTree(body.get());assertThat(sent.size()).isEqualTo(3);assertThat(sent.path("model").asText()).isEqualTo("installed-model");assertThat(sent.path("keep_alive").asInt()).isEqualTo(2700);assertThat(sent.has("prompt")).isFalse();
            assertThatThrownBy(()->gateway.prepare(new LlmGateway.PrepareRequest("missing"))).isInstanceOf(ResponseStatusException.class);assertThat(calls.get()).isEqualTo(1);
            env.withProperty("OLLAMA_KEEP_ALIVE_MINUTES","0");assertThatThrownBy(()->gateway.prepare(new LlmGateway.PrepareRequest("installed-model"))).isInstanceOf(ResponseStatusException.class);assertThat(calls.get()).isEqualTo(1);
        }finally{server.stop(0);}
    }
    @Test void absentProviderMetricsRemainUnknownInsteadOfZero() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/api/chat",exchange->{byte[] bytes="{\"done\":true,\"done_reason\":\"stop\",\"message\":{\"content\":\"{}\"}}".getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();});server.start();
        try {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OLLAMA_REASONING_EFFORT","");
            var metrics=new LlmGateway(env).generate("ollama","local-test","system","context",List.of()).metrics();assertThat(metrics.loadSeconds()).isNull();assertThat(metrics.promptSeconds()).isNull();assertThat(metrics.tokensPerSecond()).isNull();assertThat(metrics.requestSeconds()).isGreaterThanOrEqualTo(0);
        }finally{server.stop(0);}
    }

    @Test void customRetentionOverridesDefaultAndUnloadSendsNoPrompt() throws Exception {
        var body=new AtomicReference<String>();var calls=new java.util.concurrent.atomic.AtomicInteger();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/api/generate",e->{body.set(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));calls.incrementAndGet();var request=JSON.readTree(body.get());byte[] bytes=JSON.writeValueAsString(java.util.Map.of("done",true,"done_reason",request.path("keep_alive").asInt()==0?"unload":"load")).getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
        try {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OLLAMA_MODELS","installed");var gateway=new LlmGateway(env);
            assertThat(gateway.prepare(new LlmGateway.PrepareRequest("installed",60)).keepAliveMinutes()).isEqualTo(60);assertThat(JSON.readTree(body.get()).path("keep_alive").asInt()).isEqualTo(3600);
            for(int invalid:List.of(0,-1,241))assertThatThrownBy(()->gateway.prepare(new LlmGateway.PrepareRequest("installed",invalid))).isInstanceOf(ResponseStatusException.class);
            assertThat(calls.get()).isEqualTo(1);assertThat(gateway.unload(new LlmGateway.UnloadRequest("installed")).unloaded()).isTrue();
            var sent=JSON.readTree(body.get());assertThat(sent.path("keep_alive").asInt()).isZero();assertThat(sent.size()).isEqualTo(3);assertThat(sent.has("prompt")).isFalse();
        }finally{server.stop(0);}
    }
    @Test void unloadCannotInterruptAnActiveModelRequest() throws Exception {
        var started=new java.util.concurrent.CountDownLatch(1);var release=new java.util.concurrent.CountDownLatch(1);var unloadCalls=new java.util.concurrent.atomic.AtomicInteger();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.setExecutor(java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor());
        server.createContext("/api/chat",e->{started.countDown();try{release.await(5,java.util.concurrent.TimeUnit.SECONDS);}catch(InterruptedException x){Thread.currentThread().interrupt();}byte[] bytes="{\"done\":true,\"done_reason\":\"stop\",\"message\":{\"content\":\"{}\"}}".getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});
        server.createContext("/api/generate",e->{unloadCalls.incrementAndGet();e.sendResponseHeaders(500,-1);e.close();});server.start();
        try(var pool=java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OLLAMA_MODELS","installed").withProperty("OLLAMA_REASONING_EFFORT","");var gateway=new LlmGateway(env);
            var result=pool.submit(()->gateway.generate("ollama","installed","system","context",List.of(),5));assertThat(started.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            try {assertThatThrownBy(()->gateway.unload(new LlmGateway.UnloadRequest("installed"))).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(409));assertThat(unloadCalls.get()).isZero();}finally{release.countDown();}
            assertThat(result.get(5,java.util.concurrent.TimeUnit.SECONDS).text()).isEqualTo("{}");
        }finally{release.countDown();server.stop(0);}
    }
}
