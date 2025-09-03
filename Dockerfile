### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish
ARG REQUIRE_CHOWN="true"
ARG BUILD_IMAGE=docker.io/library/node@sha256:37c7b4cd8867313fc17ba76c1a6676414c61e2aac113694072bb8e3ef6d0a4c8
ARG BASE_IMAGE=docker.io/library/node@sha256:e8e882c692a08878d55ec8ff6c5a4a71b3edca25eda0af4406e2a160d8a93cf2

FROM ${BUILD_IMAGE} AS build

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./


COPY --chown=node:node ./hack/ ./hack/

COPY --chown=node:node ./buildctrlr.mjs ./
COPY --chown=node:node ./config/tsconfig.root.json ./config/tsconfig.root.json
COPY --chown=node:node ./src/ ./src/

# Install deps
RUN npm ci
RUN npm run build:ctrlr
RUN npm ci --omit=dev --omit=peer
RUN npm cache clean --force
# Remove unused dependencies in the controller image, usually needed by Pepr CLI
RUN npm uninstall @types/* ramda esbuild fast-glob ts-morph quicktype-core commander heredoc
RUN npm uninstall @esbuild/* @ts-morph/* @npmcli/* @pkgjs/* @glideapps/* @jsep-plugin/* @sigstore/*
RUN npm uninstall bin-links cacache
# Remove any remaining directories that npm uninstall might miss
RUN rm -rf node_modules/@types
RUN rm -rf node_modules/benchmarks
RUN rm -rf node_modules/cacache
RUN npm prune --omit=dev --omit=peer
RUN find . -name "*.ts" -type f -delete
RUN mkdir node_modules/pepr
RUN cp -r dist node_modules/pepr/dist
RUN cp package.json node_modules/pepr


##### DELIVER #####

FROM ${BASE_IMAGE}

WORKDIR /app

ARG REQUIRE_CHOWN="true"
ENV REQUIRE_CHOWN=${REQUIRE_CHOWN}


COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
RUN if [ "$REQUIRE_CHOWN" = "true" ]; then \
      mkdir -p /app && chown -R 65532:65532 /app; \
    fi
USER 65532
