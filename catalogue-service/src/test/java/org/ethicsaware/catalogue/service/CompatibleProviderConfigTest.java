package org.ethicsaware.catalogue.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import tools.jackson.databind.json.JsonMapper;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class CompatibleProviderConfigTest {
    @TempDir Path directory;
    @Test void persistedKeysAreNeverReturnedAndNeverReusedForADifferentEndpoint() throws Exception {
        var env=new MockEnvironment().withProperty("OPENAI_COMPATIBLE_CONFIG_PATH",directory.resolve("config/provider.json").toString());
        var store=new CompatibleProviderConfig(env);assertThat(store.view().baseUrl()).isEmpty();
        var first=store.save(new CompatibleProviderConfig.Update("https://first.example/custom/v1/","arbitrary-provider-token",false,"max_tokens",2048,false));
        assertThat(first.baseUrl()).isEqualTo("https://first.example/custom/v1");assertThat(first.hasApiKey()).isTrue();
        assertThat(JsonMapper.builder().build().writeValueAsString(first)).doesNotContain("arbitrary-provider-token");
        assertThat(store.current().toString()).doesNotContain("arbitrary-provider-token");
        assertThat(new CompatibleProviderConfig(env).current().apiKey()).isEqualTo("arbitrary-provider-token");
        store.save(new CompatibleProviderConfig.Update(first.baseUrl(),null,false,"max_completion_tokens",1024,true));
        assertThat(store.current().apiKey()).isEqualTo("arbitrary-provider-token");assertThat(store.view().connectionId()).isNotEqualTo(first.connectionId());
        store.save(new CompatibleProviderConfig.Update("https://second.example/v1",null,false,"none",4096,false));assertThat(store.current().apiKey()).isEmpty();
        for(String invalid:List.of("file:///tmp/config","https://user:secret@example.org/v1","https://example.org/v1?key=secret","https://example.org/v1#fragment","https://example.org/v1/chat/completions"))
            assertThatThrownBy(()->store.save(new CompatibleProviderConfig.Update(invalid,"must-not-be-printed",false,"max_tokens",4096,false))).hasMessageNotContaining("must-not-be-printed").isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(()->store.save(new CompatibleProviderConfig.Update("http://localhost:9000/v1","bad\nkey",false,"max_tokens",4096,false))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        store.save(new CompatibleProviderConfig.Update("","key-only",false,"max_tokens",4096,false));assertThat(store.view().baseUrl()).isEqualTo("https://api.openai.com/v1");
        store.save(new CompatibleProviderConfig.Update("",null,true,"max_tokens",4096,false));assertThat(store.view().hasApiKey()).isFalse();assertThat(store.view().baseUrl()).isEmpty();
        assertThat(Files.getPosixFilePermissions(directory.resolve("config/provider.json"))).isEqualTo(java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
    }
}
