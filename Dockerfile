# syntax=docker/dockerfile:1
FROM maven:3.9.11-eclipse-temurin-25@sha256:407c4423cec0cf2981055bc2c6c0dc211d9605b6669279b95997f2d1c7e91e2c AS build
WORKDIR /workspace
COPY pom.xml ./
COPY catalogue-core/pom.xml catalogue-core/pom.xml
COPY catalogue-service/pom.xml catalogue-service/pom.xml
COPY catalogue-web/pom.xml catalogue-web/pom.xml
COPY catalogue-core/src catalogue-core/src
COPY catalogue-service/src catalogue-service/src
COPY catalogue-web catalogue-web
COPY data/catalogue-public.xlsx data/catalogue-public.xlsx
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp verify

FROM eclipse-temurin:25-jre@sha256:fd4b1c02c64eef378212e23656fc0b0caa41a357876fa0b60e51ceda94a3db64 AS runtime
WORKDIR /app
RUN mkdir -p /app/reports /app/provider-config && chmod 700 /app/provider-config && chown -R 10001:10001 /app
COPY --from=build /workspace/catalogue-service/target/catalogue-service-0.1.0-SNAPSHOT.jar /app/app.jar
COPY --from=build /workspace/catalogue-service/target/classes/org/ethicsaware/catalogue/service/HealthCheck.class /app/health/org/ethicsaware/catalogue/service/HealthCheck.class
COPY --from=build /workspace/data/catalogue-public.xlsx /app/input/catalogue.xlsx
USER 10001:10001
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 CMD ["java", "-cp", "/app/health", "org.ethicsaware.catalogue.service.HealthCheck"]
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
