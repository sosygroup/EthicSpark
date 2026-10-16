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
