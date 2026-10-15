package org.ethicsaware.catalogue.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Standalone container probe; avoids installing a shell HTTP client in the runtime. */
public final class HealthCheck {
    public static void main(String[] args) {
        try {
            var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
            var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8082/actuator/health/readiness"))
                    .timeout(Duration.ofSeconds(3)).GET().build();
            System.exit(client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200 ? 0 : 1);
        } catch (Exception ignored) { System.exit(1); }
    }
}
