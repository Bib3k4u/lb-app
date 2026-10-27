# syntax=docker/dockerfile:1

# ---- build: runs on the builder's own CPU (the jar is platform independent) ----
FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src src
RUN mvn -B -q -DskipTests package && cp target/*.jar /workspace/app.jar

# ---- runtime ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/app.jar /app/app.jar

# Container-aware heap sizing; SerialGC keeps memory low on small instances.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC" \
    SPRING_PROFILES_ACTIVE=prod

# Run as an unprivileged user (numeric, so no extra layer is needed).
USER 10001

# Render injects PORT; application.yml reads it (default 8080).
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
