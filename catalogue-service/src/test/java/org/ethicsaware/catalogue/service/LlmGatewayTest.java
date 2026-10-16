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
        server.createContext("/v1/chat/completions",exchange->{
            body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            byte[] bytes="{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"{}\"}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });server.start();
        try {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1");
            assertThat(new LlmGateway(env).generate("ollama","local-test","system","context",List.of()).text()).isEqualTo("{}");
            var sent=JSON.readTree(body.get());assertThat(sent.path("max_tokens").asInt()).isEqualTo(8192);assertThat(sent.path("reasoning_effort").asText()).isEqualTo("low");
            env.withProperty("OLLAMA_REASONING_EFFORT","").withProperty("OLLAMA_MAX_OUTPUT_TOKENS","4096");new LlmGateway(env).generate("ollama","local-test","system","context",List.of());
            sent=JSON.readTree(body.get());assertThat(sent.has("reasoning_effort")).isFalse();assertThat(sent.path("max_tokens").asInt()).isEqualTo(4096);
        } finally {server.stop(0);}
    }
    @Test void timeoutReportsSlowProcessingSeparatelyFromConnectionFailure() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/v1/chat/completions",exchange->{try{Thread.sleep(1500);}catch(InterruptedException e){Thread.currentThread().interrupt();}finally{exchange.close();}});server.start();
        try {
            var env=new MockEnvironment().withProperty("OLLAMA_BASE_URL","http://127.0.0.1:"+server.getAddress().getPort()+"/v1").withProperty("OLLAMA_TIMEOUT_SECONDS","1");
            assertThatThrownBy(()->new LlmGateway(env).generate("ollama","local-test","system","context",List.of()))
                .isInstanceOfSatisfying(ResponseStatusException.class,e->{assertThat(e.getStatusCode().value()).isEqualTo(504);assertThat(e.getReason()).contains("within 1 seconds","still loading or processing context").doesNotContain("Cannot reach");});
        } finally {server.stop(0);}
    }
}
