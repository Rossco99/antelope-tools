FROM ubuntu:24.04 AS install-stage

# Spring release to install. SPRING_REPO can point at a fork (e.g. eosphere/spring)
# once that fork publishes release .deb packages.
ARG SPRING_REPO=AntelopeIO/spring
ARG SPRING_VERSION=1.2.2
ARG SPRING_SHA256=531ed1c965f94dd7732f5e900401f132170769c45b7589819a0ba1336627687a

ENV WORK_DIR=/opt/application

# Install Spring (includes nodeos, cleos, keosd)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl -fsSL -o /tmp/spring.deb \
    "https://github.com/${SPRING_REPO}/releases/download/v${SPRING_VERSION}/antelope-spring_${SPRING_VERSION}_amd64.deb" \
  && echo "${SPRING_SHA256}  /tmp/spring.deb" | sha256sum -c - \
  && apt-get install -y --no-install-recommends /tmp/spring.deb \
  && rm /tmp/spring.deb \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR $WORK_DIR

COPY ./config $WORK_DIR/config

# ------------------------------

FROM install-stage AS run-stage

EXPOSE 8888

ENTRYPOINT ["sh", "-c", "exec keosd --data-dir \"$WORK_DIR/data\" --config-dir \"$WORK_DIR/config\""]
