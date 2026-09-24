FROM ubuntu:22.04 as install-stage

ENV WORK_DIR /opt/application
ENV SPRING_PACKAGE_URL https://github.com/AntelopeIO/spring/releases/download/v1.2.2/antelope-spring_1.2.2_amd64.deb

# Install wget
RUN apt-get update && apt-get install -y wget

# Install Spring (includes nodeos, cleos, keosd)
RUN wget -O spring.deb $SPRING_PACKAGE_URL
RUN apt-get install -y /spring.deb

# Remove all of the unnecessary files and apt cache
RUN rm ./spring.deb \
  && apt-get remove -y wget \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Define working directory
WORKDIR $WORK_DIR

# Copy application code
COPY ./ $WORK_DIR

# ------------------------------

FROM install-stage as run-stage

ENV WORK_DIR /opt/application

EXPOSE 8888

ENTRYPOINT keosd --data-dir $WORK_DIR/data --config-dir $WORK_DIR/config
